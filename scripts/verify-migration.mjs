import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || 'ignitext-pdfs';

let all = [];
let from = 0;
while (true) {
  const { data, error } = await sb
    .from('content_items')
    .select('id,title,type,unit_number,subject_id,file_url,drive_link,file_size_kb,status')
    .range(from, from + 999);
  if (error) throw error;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const { data: subs } = await sb.from('subjects').select('id,code,name,branch_id,regulation_id,semester');
const { data: brs } = await sb.from('branches').select('id,code');
const { data: regs } = await sb.from('regulations').select('id,code');
const bMap = Object.fromEntries(brs.map((b) => [b.id, b.code]));
const rMap = Object.fromEntries(regs.map((r) => [r.id, r.code]));
const sMap = Object.fromEntries(subs.map((s) => [s.id, s]));

const stats = {};
let maxKb = 0;
let minKb = 999999;
let over10mb = 0;
let nullUrl = 0;
let zeroKb = 0;

for (const row of all) {
  const s = sMap[row.subject_id];
  const br = s ? bMap[s.branch_id] : 'UNK';
  const rg = s ? rMap[s.regulation_id] : 'UNK';
  const k = `${br} ${rg}`;
  if (!stats[k]) stats[k] = { notes: 0, pyqs: 0 };
  if (row.type === 'pyq') stats[k].pyqs++;
  else stats[k].notes++;
  const kb = row.file_size_kb || 0;
  if (kb > maxKb) maxKb = kb;
  if (kb > 0 && kb < minKb) minKb = kb;
  if (kb >= 10240) over10mb++;
  if (kb === 0) zeroKb++;
  if (!row.file_url) nullUrl++;
}

console.log('TOTAL_DB_ROWS:', all.length, 'OVER_10MB:', over10mb, 'MAX_KB:', maxKb, 'MIN_KB:', minKb, 'ZERO_KB:', zeroKb, 'NULL_URL:', nullUrl);
console.log('BREAKDOWN BY BRANCH+REG:', stats);

const prog = JSON.parse(fs.readFileSync('c:/IgniteXT/migration_all_progress.json', 'utf8'));
console.log('PROGRESS_STATS:', prog.stats);

for (const fid of ['1T6dKmqmpqByMezyx9ZumtAzm0_CcxdHI', '1aBMneQWsbytV_71KdaciyTPHWJNl-CG5', '1nekdd2yfrjMY8BUIpCkOeg8Wd285Cm6E']) {
  const rows = all.filter((r) => r.drive_link === `gdrive:${fid}`);
  for (const r of rows) {
    const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: r.file_url }));
    const bytes = Buffer.from(await obj.Body.transformToByteArray());
    const tmpPdf = path.join(os.tmpdir(), `chk_${fid}.pdf`);
    fs.writeFileSync(tmpPdf, bytes);
    const pyOut = execFileSync('python', [
      '-c',
      `import pymupdf; d=pymupdf.open(r'${tmpPdf}'); print('pages=', len(d), 'p1=', repr(d[0].get_text()[:180]))`,
    ]).toString().trim();
    try { fs.unlinkSync(tmpPdf); } catch {}
    console.log('VERIFY_FILE:', r.title, '| key:', r.file_url, '| MB:', (bytes.length / 1048576).toFixed(2), '|', pyOut);
  }
}

const uniqueKeys = [...new Set(all.map((r) => r.file_url).filter(Boolean))];
let r2Ok = 0;
let r2Missing = [];
for (let i = 0; i < uniqueKeys.length; i += 25) {
  const batch = uniqueKeys.slice(i, i + 25);
  await Promise.all(
    batch.map(async (k) => {
      try {
        const h = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: k }));
        if ((h.ContentLength || 0) > 0 && (h.ContentLength || 0) < 10 * 1048576) {
          r2Ok++;
        } else {
          r2Missing.push({ key: k, len: h.ContentLength });
        }
      } catch (e) {
        r2Missing.push({ key: k, err: e.message });
      }
    }),
  );
}
console.log(`R2_AUDIT: ${r2Ok}/${uniqueKeys.length} unique R2 objects exist, non-empty, and strictly < 10 MB. Issues: ${r2Missing.length}`);
if (r2Missing.length > 0) console.log('R2_ISSUES:', r2Missing.slice(0, 20));

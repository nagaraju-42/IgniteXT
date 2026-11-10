import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { PyWorkerPool } from './py-worker-pool.mjs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'ignitext-pdfs';
const MAX_KB = 9728; // 9.5 MB strict limit (< 10 MB)

async function streamToFile(body, outPath) {
  const bytes = await body.transformToByteArray();
  fs.writeFileSync(outPath, bytes);
}

async function main() {
  const { data: bigRows, error } = await sb
    .from('content_items')
    .select('id,title,file_url,file_size_kb')
    .gt('file_size_kb', MAX_KB)
    .order('file_size_kb', { ascending: false });

  if (error) throw error;
  if (!bigRows || bigRows.length === 0) {
    console.log('No oversized items (> 9.5 MB) found!');
    return;
  }

  const byUrl = new Map();
  for (const row of bigRows) {
    if (!row.file_url) continue;
    if (!byUrl.has(row.file_url)) byUrl.set(row.file_url, []);
    byUrl.get(row.file_url).push(row);
  }

  console.log(`Found ${bigRows.length} rows (${byUrl.size} distinct R2 objects) > ${MAX_KB} KB`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'semkit-recomp-'));
  const pool = new PyWorkerPool(3);
  pool.start();

  const entries = Array.from(byUrl.entries());
  let done = 0;
  let failed = 0;

  async function processOne([key, rows], idx) {
    const rawPath = path.join(tmpDir, `${idx}_in.pdf`);
    const outPath = path.join(tmpDir, `${idx}_out.pdf`);
    try {
      const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      await streamToFile(obj.Body, rawPath);

      const res = await pool.exec({
        op: 'compress',
        in_path: rawPath,
        out_path: outPath,
        max_mb: 9.5,
      });

      if (!res.ok) throw new Error(res.error || 'compress_failed');
      const outBuf = fs.readFileSync(outPath);
      const newKb = Math.max(1, Math.round(outBuf.length / 1024));
      if (newKb > 10000) throw new Error(`Output still too big: ${newKb} KB`);

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: outBuf,
          ContentType: 'application/pdf',
        }),
      );

      const ids = rows.map((r) => r.id);
      const { error: updErr } = await sb
        .from('content_items')
        .update({ file_size_kb: newKb })
        .in('id', ids);
      if (updErr) throw updErr;

      done++;
      const oldKb = rows[0].file_size_kb;
      console.log(
        `[${done}/${entries.length}] ${key}: ${(oldKb / 1024).toFixed(2)} MB -> ${(newKb / 1024).toFixed(2)} MB (${res.method}, ${res.pages}p, updated ${ids.length} row(s))`,
      );
    } catch (e) {
      failed++;
      console.error(`[FAIL] ${key}: ${e.message}`);
    } finally {
      try { fs.unlinkSync(rawPath); } catch {}
      try { fs.unlinkSync(outPath); } catch {}
    }
  }

  // Run 3 concurrent R2+compression tasks
  let cursor = 0;
  const workers = Array.from({ length: 3 }, async () => {
    while (cursor < entries.length) {
      const i = cursor++;
      await processOne(entries[i], i);
    }
  });
  await Promise.all(workers);

  await pool.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  console.log(`\nRecompression complete: ${done} succeeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

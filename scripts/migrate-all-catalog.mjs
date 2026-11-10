import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { mapCatalogFile } from './catalog-mapper.mjs';
import { PyWorkerPool } from './py-worker-pool.mjs';

const TAXONOMY_PATH = 'c:/IgniteXT/migration_taxonomy_map.json';
const PROGRESS_PATH = 'c:/IgniteXT/migration_all_progress.json';
const SUPERADMIN_ID = 'e3c93c4f-bc31-4bc9-9bc6-7d897fa6e0d5';
const BUCKET = process.env.R2_BUCKET_NAME || 'ignitext-pdfs';
const MAX_MB = 9.5;
const CONCURRENCY = 4;

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

const CACHE_DIR = path.join(os.tmpdir(), 'semkit_catalog_pdf_cache');
const RAW_DIR = path.join(os.tmpdir(), 'semkit_catalog_raw_tmp');
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    } catch {}
  }
  return { entries: {}, stats: { success: 0, skipped: 0, failed: 0 } };
}

function saveProgress(prog) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(prog, null, 2));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function romanOrIntToUnit(token) {
  const up = token.toUpperCase();
  const romans = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  return romans[up] || parseInt(up, 10) || null;
}

function detectUnits(text, allowBareNumber = true) {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;

  if (/(?:units?|chapter|ch)\s*[\(\[:\-]?\s*(?:1|i)\s*(?:to|[\-&,])\s*(?:5|v)\b|all\s*units?|chapter[\-\s]*i[\-\s]*v\b/i.test(lower)) {
    return [1, 2, 3, 4, 5];
  }
  if (/(?:units?|u)\s*[\-:]?\s*1\s*(?:to|[\-&,])\s*4\b|1,2,3,4|1\s*-\s*4\s*notes/i.test(lower)) {
    return [1, 2, 3, 4];
  }
  if (/(?:units?|u)\s*[\-:]?\s*1\s*(?:to|[\-&,])\s*3\b|1,2,3/i.test(lower)) {
    return [1, 2, 3];
  }
  if (/(?:units?|u)\s*[\-:]?\s*3\s*(?:to|[\-&,])\s*5\b|3\s*-\s*5\.pdf/i.test(lower)) {
    return [3, 4, 5];
  }
  if (/(?:units?|u)?\s*1\s*(?:&|and|,)\s*2\b|u1\s*u2|1&2|1\s*&\s*2/i.test(lower)) {
    return [1, 2];
  }
  if (/(?:units?|u)?\s*2\s*(?:&|and|,|-)\s*3\b|2-3/i.test(lower)) {
    return [2, 3];
  }
  if (/(?:units?|u)?\s*3\s*(?:&|and|,)\s*4\b|3&4|3,4|u3\s*u4|iii\s*&\s*iv|iii&iv/i.test(lower)) {
    return [3, 4];
  }
  if (/(?:units?|u)?\s*4\s*(?:&|and|,)\s*5\b|4&5/i.test(lower)) {
    return [4, 5];
  }

  const uMatch = lower.match(/(?:unit|chapter|ch|module|mod|u)[\s_\-:]*([1-5]|iii|ii|iv|i|v)(?:[^a-z0-9]|$)/i);
  if (uMatch) {
    const u = romanOrIntToUnit(uMatch[1]);
    if (u) return [u];
  }

  if (allowBareNumber) {
    const endNum = lower.match(/(?:_|\s|\-)0?([1-5])(?:\s*\(\d+\))?\.(?:pdf|pptx?|docx?|jpg)$/i);
    if (endNum) return [parseInt(endNum[1], 10)];
    const leadingNum = lower.match(/^0?([1-5])[\s._\-]/);
    if (leadingNum) return [parseInt(leadingNum[1], 10)];
  }
  return null;
}

function classifyFileMetadata(file, previewText) {
  const pathList = (file.path || []).map((s) => s.trim());
  const lowerPath = pathList.join(' / ').toLowerCase();
  const fn = (file.name || '').trim();
  const lowerName = fn.toLowerCase();
  const lowerText = (previewText || '').toLowerCase();

  // Check special structural documents first
  const isSyllabus = lowerPath.includes('syllabus') || lowerName.includes('syllabus') || lowerName.includes('curriculam') || lowerName.includes('structure and syllabus');
  const isHandout = lowerName.includes('handout');
  const isLabManual = lowerPath.includes('lab manual') || lowerName.includes('lab manual') || lowerName.includes('lab syllabus');
  const isTextbook = lowerName.includes('textbook') || lowerName.includes('edition') || lowerName.includes('designmanual') || lowerName.includes('mitchell') || lowerName.includes('-book') || lowerName.includes('certification kit');

  // Determine category: 'pyq' | 'imp' | 'note'
  let category = 'note';
  if (isSyllabus || isHandout || isLabManual) {
    category = 'note';
  } else if (
    file.kind === 'papers' ||
    /\b(pyq|pyqs|mids|exam papers|question papers)\b/i.test(lowerPath) ||
    /(pyq|previous\s*year|sem\.pdf|mid[\s\-_]*(?:1|2|i|ii|paper|term)|question\s*paper|model\s*paper|\bqp\b|end\s*sem|supplementary|scheme&key)/i.test(lowerName)
  ) {
    category = 'pyq';
  } else if (
    /\b(topics|imp questions|scenario questions)\b/i.test(lowerPath) ||
    /(\bimp\b|important|\bti\b|\bti's\b|question\s*bank|\blmr\b)/i.test(lowerName)
  ) {
    category = 'imp';
  }

  // Unit span detection: Path unit folder -> Filename -> First 3 pages PDF text -> Default 1
  let unitSpan = null;
  for (let i = pathList.length - 1; i >= 0; i--) {
    const seg = pathList[i];
    if (/^(?:unit|u)[\s\-_]*([1-5])$/i.test(seg)) {
      unitSpan = detectUnits(seg, true);
      if (unitSpan) break;
    }
  }
  if (!unitSpan) unitSpan = detectUnits(fn, true);
  if (!unitSpan && lowerText) unitSpan = detectUnits(lowerText.slice(0, 1200), false);
  if (!unitSpan || unitSpan.length === 0) unitSpan = [1];

  // Exam sub-metadata for PYQs
  let examType = null;
  let examYear = null;
  let pyqTag = 'SEM Exam';
  if (category === 'pyq') {
    const combined = `${lowerName}\n${lowerText.slice(0, 800)}`;
    if (/supplementary/i.test(combined)) {
      examType = 'supplementary';
      pyqTag = 'Supply Exam';
    } else if (/mid[\s\-_]*(?:1|i)\b/i.test(combined)) {
      examType = 'mid1';
      pyqTag = 'Mid-1 Paper';
    } else if (/mid[\s\-_]*(?:2|ii)\b/i.test(combined)) {
      examType = 'mid2';
      pyqTag = 'Mid-2 Paper';
    } else if (/\bmid\b/i.test(combined)) {
      examType = 'mid1';
      pyqTag = 'Mid Paper';
    } else if (/model\s*paper|question\s*bank|unit\s*wise\s*questions/i.test(combined)) {
      examType = 'semester';
      pyqTag = 'Model / Question Bank';
    } else {
      examType = 'semester';
      pyqTag = 'SEM Exam';
    }
    const ym = combined.match(/\b(202[0-6])\b/);
    examYear = ym ? parseInt(ym[1], 10) : 2024;
  }

  // Clean hint for notes
  let specialKind = null;
  if (isSyllabus) specialKind = 'Syllabus';
  else if (isHandout) specialKind = 'Course Handout';
  else if (isLabManual) specialKind = 'Lab Manual';
  else if (isTextbook) specialKind = 'Textbook';

  const topicMatch = fn.match(/\(([^)]+)\)/);
  let topicHint = topicMatch && !/^(?:\d+|r22|r24|au|1|2)$/i.test(topicMatch[1].trim())
    ? topicMatch[1].trim()
    : '';
  if (!topicHint) {
    if (lowerName.includes('handwritten') || /\bhn\b/i.test(lowerName)) topicHint = 'Handwritten';
    else if (lowerName.includes('lmr')) topicHint = 'LMR';
    else if (lowerName.includes('short notes') || lowerName.includes('shortnotes')) topicHint = 'Short Notes';
  }

  return {
    category,
    specialKind,
    primaryUnit: unitSpan[0],
    unitSpan,
    examType,
    examYear,
    pyqTag,
    topicHint,
  };
}

/**
 * Download, convert (Slides/Docs/JPG -> PDF), compress (< 9.5 MB), and cache locally by file.id.
 */
const inFlightById = new Map();

async function ensureCachedPdf(file, pool) {
  const cachedPdf = path.join(CACHE_DIR, `${file.id}.pdf`);
  const cachedMeta = path.join(CACHE_DIR, `${file.id}.meta.json`);

  if (fs.existsSync(cachedPdf) && fs.existsSync(cachedMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(cachedMeta, 'utf8'));
      if (meta.empty) return meta;
      if (fs.statSync(cachedPdf).size > 0) {
        return { ...meta, pdfPath: cachedPdf };
      }
    } catch {}
  }

  if (inFlightById.has(file.id)) {
    return inFlightById.get(file.id);
  }

  const p = (async () => {
    const ext = (file.ext || '').toLowerCase();
    const rawTmp = path.join(RAW_DIR, `${file.id}_${Date.now()}.${ext || 'bin'}`);
    const convTmp = path.join(RAW_DIR, `${file.id}_${Date.now()}_conv.pdf`);

    try {
      let urls = [];
      if (ext === 'pptx' || ext === 'ppt') {
        urls = [
          `https://docs.google.com/presentation/d/${file.id}/export/pdf`,
          `https://drive.google.com/uc?export=download&id=${file.id}`,
        ];
      } else if (ext === 'docx' || ext === 'doc') {
        urls = [
          `https://docs.google.com/document/d/${file.id}/export?format=pdf`,
          `https://drive.google.com/uc?export=download&id=${file.id}`,
        ];
      } else {
        urls = [`https://drive.google.com/uc?export=download&id=${file.id}`];
      }

      let downloadedBytes = null;
      let usedUrl = '';
      let lastErr = null;

      for (const url of urls) {
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const resp = await fetch(url, {
              redirect: 'follow',
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            });
            if (resp.status === 429 || resp.status >= 500) {
              throw new Error(`HTTP ${resp.status}`);
            }
            if (!resp.ok) {
              throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
            }
            const ab = await resp.arrayBuffer();
            const buf = Buffer.from(ab);
            usedUrl = url;
            downloadedBytes = buf;
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < 4) await sleep(1200 * attempt + Math.random() * 600);
          }
        }
        if (downloadedBytes !== null) {
          // If first export URL returned non-PDF/non-HTML small error, maybe try next URL
          const head5 = downloadedBytes.subarray(0, 5).toString();
          const headLower = downloadedBytes.subarray(0, 32).toString().trimStart().toLowerCase();
          if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') break;
          if (head5 === '%PDF-' || headLower.startsWith('<!doctype html') || headLower.startsWith('<html') || downloadedBytes.length === 0) {
            break;
          }
        }
      }

      if (downloadedBytes === null) {
        throw lastErr || new Error('Download failed');
      }

      if (downloadedBytes.length === 0) {
        const emptyMeta = { empty: true, reason: 'empty_file' };
        fs.writeFileSync(cachedMeta, JSON.stringify(emptyMeta));
        return emptyMeta;
      }

      // Check HTML virus-scan warning page -> use Python cookie-jar downloader
      const headStr = downloadedBytes.subarray(0, 48).toString('utf8').trimStart().toLowerCase();
      if (headStr.startsWith('<!doctype html') || headStr.startsWith('<html')) {
        const dlRes = await pool.exec({ op: 'download_gdrive', file_id: file.id, out_path: rawTmp });
        if (!dlRes.ok) throw new Error(dlRes.error || 'download_gdrive_failed');
        if (dlRes.bytes === 0) {
          const emptyMeta = { empty: true, reason: 'empty_file' };
          fs.writeFileSync(cachedMeta, JSON.stringify(emptyMeta));
          return emptyMeta;
        }
      } else {
        fs.writeFileSync(rawTmp, downloadedBytes);
      }

      // Inspect magic header of rawTmp
      const hdrBuf = Buffer.alloc(16);
      const fd = fs.openSync(rawTmp, 'r');
      const bytesRead = fs.readSync(fd, hdrBuf, 0, 16, 0);
      fs.closeSync(fd);
      const magic = hdrBuf.subarray(0, bytesRead);

      let res;
      if (magic.includes(Buffer.from('%PDF-'))) {
        res = await pool.exec({ op: 'compress', in_path: rawTmp, out_path: cachedPdf, max_mb: MAX_MB });
      } else if (
        ext === 'jpg' ||
        ext === 'jpeg' ||
        ext === 'png' ||
        (magic[0] === 0xff && magic[1] === 0xd8) ||
        magic.subarray(1, 4).toString() === 'PNG'
      ) {
        res = await pool.exec({ op: 'jpg2pdf', in_path: rawTmp, out_path: cachedPdf, max_mb: MAX_MB });
      } else {
        // Fallback try jpg2pdf or fail cleanly with magic info
        throw new Error(`Unsupported binary content from ${usedUrl} (header=${magic.toString('hex').slice(0, 16)})`);
      }

      if (!res.ok) {
        if (res.error === 'empty_file') {
          const emptyMeta = { empty: true, reason: 'empty_file' };
          fs.writeFileSync(cachedMeta, JSON.stringify(emptyMeta));
          return emptyMeta;
        }
        throw new Error(res.error || 'pdf_worker_failed');
      }

      const meta = {
        empty: false,
        bytes: res.bytes,
        in_bytes: res.in_bytes || res.bytes,
        pages: res.pages || 1,
        method: res.method || 'passthrough',
        text: res.text || '',
      };
      fs.writeFileSync(cachedMeta, JSON.stringify(meta));
      return { ...meta, pdfPath: cachedPdf };
    } finally {
      try { fs.unlinkSync(rawTmp); } catch {}
      try { fs.unlinkSync(convTmp); } catch {}
      inFlightById.delete(file.id);
    }
  })();

  inFlightById.set(file.id, p);
  return p;
}

async function main() {
  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
  const progress = loadProgress();

  // Fetch existing content_items (subject_id + drive_link) to guarantee 100% DB idempotency
  console.log('Checking existing content_items in Supabase...');
  const existingPairs = new Set();
  let pageFrom = 0;
  while (true) {
    const { data, error } = await sb
      .from('content_items')
      .select('subject_id,drive_link,title')
      .range(pageFrom, pageFrom + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.drive_link) existingPairs.add(`${row.subject_id}::${row.drive_link}`);
    }
    if (data.length < 1000) break;
    pageFrom += 1000;
  }
  console.log(`Found ${existingPairs.size} already-linked Drive items in Supabase.`);

  console.log('Fetching live catalog from exams.ignitext.tech/api/catalog...');
  const cat = await (await fetch('https://exams.ignitext.tech/api/catalog')).json();
  const allFiles = cat.allFiles || [];

  const queue = [];
  for (const f of allFiles) {
    const mapped = mapCatalogFile(f);
    if (mapped.skipAlreadyMigrated) continue;
    const entryKey = `${f.departmentCode}::${(f.path || []).join('/')}::${f.id}`;
    queue.push({ file: f, targets: mapped.targets, entryKey });
  }

  // Deterministic order so Unit/PYQ sequence numbers are tidy per subject
  queue.sort((a, b) => a.entryKey.localeCompare(b.entryKey));
  console.log(`Queued ${queue.length} entries to migrate (excluding CSE 3rd/4th R22).\n`);

  const pool = new PyWorkerPool(CONCURRENCY);
  pool.start();

  // Single-threaded sequence number allocator (per subjectId + bucketKey)
  const seqCounters = {};
  for (const item of queue) {
    const prev = progress.entries[item.entryKey];
    if (prev && prev.status === 'success') {
      for (const bk of prev.seqKeys || []) {
        seqCounters[bk] = (seqCounters[bk] || 0) + 1;
      }
    }
  }
  function nextSeq(subjectId, bucketKey) {
    const k = `${subjectId}::${bucketKey}`;
    seqCounters[k] = (seqCounters[k] || 0) + 1;
    return seqCounters[k];
  }

  let completedCount = 0;
  let failedEntries = [];

  async function processEntry(item, idx) {
    const { file, targets, entryKey } = item;
    const prev = progress.entries[entryKey];
    if (prev && (prev.status === 'success' || prev.status === 'skipped')) {
      completedCount++;
      return;
    }

    try {
      const pdfInfo = await ensureCachedPdf(file, pool);
      if (pdfInfo.empty) {
        progress.entries[entryKey] = { status: 'skipped', reason: pdfInfo.reason || 'empty_file' };
        progress.stats.skipped++;
        saveProgress(progress);
        completedCount++;
        console.log(`[${completedCount}/${queue.length}] SKIP (empty 0-byte Drive file): ${file.name}`);
        return;
      }

      const pdfBuffer = fs.readFileSync(pdfInfo.pdfPath);
      const sizeKb = Math.max(1, Math.round(pdfBuffer.length / 1024));
      if (pdfBuffer.length > 10 * 1048576) {
        throw new Error(`Safety check failed: ${(pdfBuffer.length / 1048576).toFixed(2)} MB >= 10 MB`);
      }

      const meta = classifyFileMetadata(file, pdfInfo.text);
      const driveLink = `gdrive:${file.id}`;
      const insertedRows = [];
      const uploadedKeys = [];
      const seqKeys = [];

      for (const t of targets) {
        const subKey = `${t.branch}:${t.reg}:${t.sem}:${t.code}`;
        const sub = taxonomy.subjects[subKey];
        if (!sub) throw new Error(`Missing subject in taxonomy map: ${subKey}`);

        if (existingPairs.has(`${sub.id}::${driveLink}`)) {
          continue; // already inserted safely in DB
        }

        const bucketKey = meta.specialKind
          ? `SPECIAL_${meta.specialKind}`
          : `${meta.category}_${meta.primaryUnit}`;
        seqKeys.push(`${sub.id}::${bucketKey}`);
        const seq = nextSeq(sub.id, bucketKey);

        let cleanTitle = '';
        if (meta.specialKind) {
          cleanTitle = seq > 1 ? `${sub.code} ${meta.specialKind}-${seq}` : `${sub.code} ${meta.specialKind}`;
        } else if (meta.category === 'pyq') {
          cleanTitle = `${sub.code} PYQ-${seq} (${meta.pyqTag})`;
        } else if (meta.category === 'imp') {
          const hint = meta.topicHint || 'Important Questions';
          cleanTitle = `${sub.code} IMP-${seq} (${hint})`;
        } else {
          const spanStr = meta.unitSpan.length > 1 ? ` (Units ${meta.unitSpan.join(', ')})` : '';
          const topicStr = meta.topicHint ? ` (${meta.topicHint})` : '';
          cleanTitle = `${sub.code} Unit-${meta.primaryUnit}-${seq}${spanStr}${topicStr}`;
        }

        const safeFileSlug = cleanTitle.replace(/[\s/\\?%*:|"<>]+/g, '_');
        const r2Key = `${t.branch}/${t.reg}/${t.sem}/${sub.code}/${safeFileSlug}_${file.id.slice(-6)}.pdf`;

        await r2.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: r2Key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
          }),
        );
        uploadedKeys.push(r2Key);

        const dbType = meta.category === 'pyq' ? 'pyq' : 'note';
        const rowsToInsert = [
          {
            subject_id: sub.id,
            uploaded_by: SUPERADMIN_ID,
            type: dbType,
            title: cleanTitle,
            unit_number: dbType === 'note' ? meta.primaryUnit : null,
            unit_title: meta.specialKind || meta.topicHint || (meta.category === 'imp' ? 'Important Topics' : null),
            exam_type: dbType === 'pyq' ? meta.examType : null,
            exam_year: dbType === 'pyq' ? meta.examYear : null,
            file_url: r2Key,
            drive_link: driveLink,
            file_size_kb: sizeKb,
            status: 'published',
          },
        ];

        // Multi-unit cross-index rows
        if (dbType === 'note' && !meta.specialKind && meta.unitSpan.length > 1) {
          for (let u = 1; u < meta.unitSpan.length; u++) {
            const secUnit = meta.unitSpan[u];
            const secTitle = `${sub.code} Unit-${secUnit}-${seq} (Units ${meta.unitSpan.join(', ')})`;
            rowsToInsert.push({
              subject_id: sub.id,
              uploaded_by: SUPERADMIN_ID,
              type: 'note',
              title: secTitle,
              unit_number: secUnit,
              unit_title: `Multi-unit note (${meta.unitSpan.join(', ')})`,
              exam_type: null,
              exam_year: null,
              file_url: r2Key,
              drive_link: driveLink,
              file_size_kb: sizeKb,
              status: 'published',
            });
          }
        }

        const { data: insData, error: insErr } = await sb
          .from('content_items')
          .insert(rowsToInsert)
          .select('id');
        if (insErr) throw insErr;

        existingPairs.add(`${sub.id}::${driveLink}`);
        for (const r of insData || []) insertedRows.push(r.id);
      }

      progress.entries[entryKey] = {
        status: 'success',
        fileId: file.id,
        sizeKb,
        method: pdfInfo.method,
        pages: pdfInfo.pages,
        uploadedKeys,
        insertedRows,
        seqKeys,
      };
      progress.stats.success++;
      if (completedCount % 10 === 0) saveProgress(progress);

      completedCount++;
      const inMb = ((pdfInfo.in_bytes || pdfBuffer.length) / 1048576).toFixed(2);
      const outMb = (pdfBuffer.length / 1048576).toFixed(2);
      const compTag = pdfInfo.method !== 'passthrough' ? `${inMb}MB->${outMb}MB [${pdfInfo.method}]` : `${outMb}MB`;
      console.log(
        `[${completedCount}/${queue.length}] OK ${targets.map((x) => `${x.branch}/${x.reg}/S${x.sem}/${x.code}`).join(',')} | ${file.name} (${compTag}, ${insertedRows.length} rows)`,
      );
    } catch (e) {
      progress.entries[entryKey] = { status: 'failed', error: e.message };
      progress.stats.failed++;
      completedCount++;
      failedEntries.push({ entryKey, name: file.name, ext: file.ext, id: file.id, error: e.message });
      console.error(`[${completedCount}/${queue.length}] FAIL ${file.name} (${file.ext}, id=${file.id}): ${e.message}`);
    }
  }

  let cursor = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < queue.length) {
      const idx = cursor++;
      await processEntry(queue[idx], idx);
    }
  });
  await Promise.all(runners);

  const vals = Object.values(progress.entries);
  progress.stats = {
    success: vals.filter((v) => v.status === 'success').length,
    skipped: vals.filter((v) => v.status === 'skipped').length,
    failed: vals.filter((v) => v.status === 'failed').length,
  };
  saveProgress(progress);
  await pool.close();

  console.log('\n============================================================');
  console.log(`MIGRATION BATCH COMPLETE: ${queue.length} total entries`);
  console.log(`Success: ${progress.stats.success} | Skipped: ${progress.stats.skipped} | Failed (this run): ${failedEntries.length}`);
  if (failedEntries.length > 0) {
    fs.writeFileSync('c:/IgniteXT/migration_failures.json', JSON.stringify(failedEntries, null, 2));
    console.log('Saved failure list to c:/IgniteXT/migration_failures.json');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

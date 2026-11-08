import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function deriveShortCode(name, existingShort) {
  if (existingShort && existingShort.trim().length > 0) {
    return existingShort.trim().toUpperCase();
  }
  const stopWords = new Set(['and', 'of', 'in', 'to', 'for', 'the', 'fundamentals', 'introduction']);
  const clean = name.replace(/[()\-–—_]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()));

  let acronym = '';
  for (const word of words) {
    if (word.toLowerCase() === 'lab') {
      acronym += ' Lab';
    } else {
      acronym += word[0].toUpperCase();
    }
  }
  return acronym || name.substring(0, 3).toUpperCase();
}

export async function uploadMaterial({ filePath, subjectQuery, type = 'notes', unit = 1, year = 2025 }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Find subject
  const { data: subs, error: subErr } = await supabase
    .from('subjects')
    .select('id, name, code, semester, unit_names, branches(code), regulations(code)')
    .or(`name.ilike.%${subjectQuery}%,code.ilike.%${subjectQuery}%`)
    .limit(1);

  if (subErr || !subs || subs.length === 0) {
    throw new Error(`Subject not found matching: "${subjectQuery}"`);
  }

  const subject = subs[0];
  const shortCode = deriveShortCode(subject.name, null);
  const branchCode = subject.branches?.code || 'CSE';
  const regCode = subject.regulations?.code || 'R22';
  const semester = subject.semester || 1;

  console.log(`Found Subject: [${shortCode}] ${subject.name} (${subject.code || 'No code'})`);

  const categoryType = type === 'notes' ? 'note' : type === 'pyq' ? 'pyq' : 'imp';

  // Count existing items
  let countQuery = supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', subject.id)
    .eq('type', categoryType);

  if (categoryType === 'note') {
    countQuery = countQuery.eq('unit_number', unit);
  }

  const { count: existingCount } = await countQuery;
  const nextSeq = (existingCount || 0) + 1;

  let autoTitle = '';
  if (categoryType === 'note') {
    autoTitle = `${shortCode} Unit-${unit}-${nextSeq}`;
  } else if (categoryType === 'pyq') {
    autoTitle = `${shortCode} PYQ-${nextSeq}`;
  } else {
    autoTitle = `${shortCode} IMP-${nextSeq}`;
  }

  const r2Key = `${branchCode}/${regCode}/${semester}/${shortCode}/${autoTitle.replace(/\s+/g, '_')}.pdf`;

  console.log(`Auto-generated Title: ${autoTitle}`);
  console.log(`Target R2 Key: ${r2Key}`);

  // Upload to R2
  const fileBuffer = fs.readFileSync(filePath);
  const fileSizeKb = Math.round(fileBuffer.length / 1024);

  console.log(`Uploading ${fileSizeKb} KB to Cloudflare R2 bucket "${process.env.R2_BUCKET_NAME}"...`);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: 'application/pdf',
    })
  );

  console.log(`Successfully uploaded to R2!`);

  // Insert into Supabase content_items
  const { data: dbData, error: dbErr } = await supabase
    .from('content_items')
    .insert({
      subject_id: subject.id,
      uploaded_by: 'e3c93c4f-bc31-4bc9-9bc6-7d897fa6e0d5', // superadmin
      type: categoryType,
      title: autoTitle,
      unit_number: categoryType === 'note' ? unit : null,
      unit_title: categoryType === 'note' ? (subject.unit_names?.[unit.toString()] || '') : null,
      exam_year: categoryType === 'pyq' ? year : null,
      file_url: r2Key,
      file_size_kb: fileSizeKb,
      status: 'published'
    })
    .select()
    .single();

  if (dbErr) {
    throw new Error(`Database insert failed: ${dbErr.message}`);
  }

  console.log(`Successfully published material to Supabase content_items!`);
  console.log(`ID: ${dbData.id}`);
  console.log(`Public URL: ${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${r2Key}`);

  return dbData;
}

// CLI runner
const args = process.argv.slice(2);
if (args.length >= 2) {
  const filePath = args[0];
  const subjectQuery = args[1];
  const type = args[2] || 'notes';
  const unit = parseInt(args[3] || '1', 10);

  uploadMaterial({ filePath, subjectQuery, type, unit })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cloudflare R2 setup
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const PROGRESS_FILE = path.resolve(__dirname, '../migration_r22_complete_progress.json');

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (e) {}
  }
  return { processedIds: {}, stats: { success: 0, failed: 0, skipped: 0 } };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Complete Subject mappings for R22 CSE (Semesters 5, 6, and 7)
const SUBJECT_MAP = {
  // Sem 5 (3-1)
  'WT': { id: '97a15397-6403-46be-8c92-475082130f2c', name: 'Web Technologies', shortCode: 'WT', semester: 5 },
  'OS': { id: 'b55d285b-4cf2-484c-b61c-57e67cf19683', name: 'Operating Systems', shortCode: 'OS', semester: 5 },
  'CN': { id: '4d800b50-92bb-405f-8570-a0d7bb7c0821', name: 'Computer Networks', shortCode: 'CN', semester: 5 },
  'FAI': { id: '71df89e6-d627-4984-94b2-d3522b3c6571', name: 'FAI', shortCode: 'FAI', semester: 5 },
  'ED': { id: '07c196ed-d559-4088-bba5-b7287c91224b', name: 'Entrepreneurship Development', shortCode: 'ED', semester: 5 },

  // Sem 6 (3-2)
  'BD': { id: 'e5e31b2e-cfb8-434f-8204-f7bbd534536c', name: 'Big Data', shortCode: 'BD', semester: 6 },
  'CD': { id: '3abb3cc3-4df1-4778-846b-fb52c0408ef0', name: 'Compiler Design', shortCode: 'CD', semester: 6 },
  'IOT': { id: 'd939a79e-9ef9-46ec-9d14-ac420d26ebc8', name: 'IOT', shortCode: 'IOT', semester: 6 },
  'ML': { id: '5ecd8c4b-e0e4-4eb9-8cd1-47ba4bf8c0c7', name: 'Machine Learning', shortCode: 'ML', semester: 6 },
  'SE': { id: 'bcd7a650-0611-4022-af29-74ac830fcbe6', name: 'Software Engineering', shortCode: 'SE', semester: 6 },
  'RP': { id: 'e4f9a28d-5e5d-4171-b41c-492caec178dd', name: 'R Programming', shortCode: 'RP', semester: 6 },
  'TBCS': { id: '987c22b6-cf21-4512-aa5b-2b71abce8ff7', name: 'Technical and Business Communication Skills', shortCode: 'TBCS', semester: 6 },

  // Sem 7 (4-1)
  'CIS': { id: '030537ca-9cec-4c6d-916e-7f52e98966ac', name: 'Cryptography and Information Security', shortCode: 'CIS', semester: 7 },
  'DSV': { id: '656a1ca0-761b-4d37-be88-cbd7490ae584', name: 'Data Science and Visualisation', shortCode: 'DSV', semester: 7 },
  'DSV-LAB': { id: 'dd7255f6-2341-42a2-89c4-1996b90a80b4', name: 'DSV Lab', shortCode: 'DSV-LAB', semester: 7 },
  'FBT': { id: '8fb0695f-3857-4dfe-a1c6-9deef66b8d35', name: 'Fundamentals of Blockchain Technology', shortCode: 'FBT', semester: 7 },
  'FCC': { id: '6b6191a6-5492-4f54-b59d-0fd9cd6d674b', name: 'Fundamentals of Cloud Computing', shortCode: 'FCC', semester: 7 },
  'MAD': { id: 'd33f6f51-adc4-4bff-b78c-9d50079aca3b', name: 'Mobile Application Development', shortCode: 'MAD', semester: 7 },
  'MEFA': { id: 'feb222e6-483c-4e2d-9c4b-43e3dc0e530e', name: 'MEFA', shortCode: 'MEFA', semester: 7 },
  'PM': { id: 'fe0bcf56-c8da-420b-be24-a0d6b709f9bc', name: 'Project Management', shortCode: 'PM', semester: 7 },
};

function parseItemMetadata(item) {
  const pathParts = item.path || [];
  const fileName = item.name;
  const lowerName = fileName.toLowerCase();
  const lowerPath = pathParts.join(' / ').toLowerCase();

  // Special case: 4th year syllabus
  if (lowerName.includes('syllabus') && lowerPath.includes('4th year')) {
    return {
      subjectInfo: SUBJECT_MAP['CIS'],
      category: 'note',
      primaryUnit: 1,
      unitSpan: [1],
      qualityTag: 'Official Syllabus',
      topicHint: 'R22 IV Year Complete Syllabus',
      semester: 7
    };
  }

  // 1. Identify Subject Acronym
  let detectedShort = null;

  // Check path parts
  for (const part of pathParts) {
    const cleanPart = part.trim().toUpperCase();
    if (SUBJECT_MAP[cleanPart]) {
      detectedShort = cleanPart;
      break;
    }
  }

  // Check DSV lab
  if (!detectedShort && lowerName.includes('dsv lab')) {
    detectedShort = 'DSV-LAB';
  }

  // Check filename first word
  if (!detectedShort) {
    const firstWord = fileName.split(/[\s_\-\.]+/)[0].toUpperCase();
    if (SUBJECT_MAP[firstWord]) {
      detectedShort = firstWord;
    }
  }

  // Check known codes in filename
  if (!detectedShort) {
    for (const code of Object.keys(SUBJECT_MAP)) {
      if (new RegExp(`\\b${code}\\b`, 'i').test(fileName)) {
        detectedShort = code;
        break;
      }
    }
  }

  const subjectInfo = detectedShort ? SUBJECT_MAP[detectedShort] : null;

  // 2. Identify Category: 'note' | 'pyq' | 'imp'
  let category = 'note';
  if (lowerPath.includes('pyq') || lowerName.includes('pyq') || lowerName.includes('sem.pdf') || lowerName.includes('mid.pdf') || lowerName.includes('mid papers') || lowerName.includes('mid paper')) {
    category = 'pyq';
  } else if (lowerPath.includes('topics') || lowerName.includes('imp') || lowerName.includes('important') || lowerName.includes('topics')) {
    category = 'imp';
  }

  // 3. Identify Unit numbers & multi-unit spans
  let primaryUnit = null;
  let unitSpan = [];

  if (lowerName.includes('1-4 units') || lowerName.includes('units 1-4') || lowerName.includes('1 to 4')) {
    primaryUnit = 1;
    unitSpan = [1, 2, 3, 4];
  } else if (lowerName.includes('u1 u2 u3') || lowerName.includes('unit 1, 2, 3') || lowerName.includes('units 1-3')) {
    primaryUnit = 1;
    unitSpan = [1, 2, 3];
  } else if (lowerName.includes('u1 u2') || lowerName.includes('unit 1 & 2') || lowerName.includes('unit 1 and 2') || lowerName.includes('unit 1&2')) {
    primaryUnit = 1;
    unitSpan = [1, 2];
  } else if (lowerName.includes('3&4') || lowerName.includes('3,4') || lowerName.includes('3 and 4') || lowerName.includes('u3 u4') || lowerName.includes('unit 3 & 4')) {
    primaryUnit = 3;
    unitSpan = [3, 4];
  } else if (lowerName.includes('gestalt')) {
    primaryUnit = 3;
    unitSpan = [3];
  } else {
    // Regex for unit/chapter/u
    const uMatch = lowerName.match(/(?:unit|chapter|ch|u)[\s_\-]*([1-5]|i{1,3}|iv|v)(?:[_\s\.\-]|$)/i);
    if (uMatch) {
      const val = uMatch[1].toUpperCase();
      const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 };
      primaryUnit = romanMap[val] || parseInt(val, 10) || 1;
      unitSpan = [primaryUnit];
    } else {
      const underscoreMatch = lowerName.match(/_([1-5])(?:\.|$)/);
      if (underscoreMatch) {
        primaryUnit = parseInt(underscoreMatch[1], 10);
        unitSpan = [primaryUnit];
      } else {
        const bareMatch = lowerName.match(/\b0?([1-5])\b/);
        if (bareMatch) {
          primaryUnit = parseInt(bareMatch[1], 10);
          unitSpan = [primaryUnit];
        }
      }
    }
  }

  if (!primaryUnit && category === 'note') {
    primaryUnit = 1;
    unitSpan = [1];
  }

  // 4. Quality Tag & Topic hint
  let qualityTag = 'Lecture Notes';
  if (lowerName.includes('hn') || lowerName.includes('handwritten')) {
    qualityTag = 'Handwritten Notes';
  } else if (lowerName.includes('ppt') || item.ext === 'pptx' || item.ext === 'ppt') {
    qualityTag = 'Faculty Slides';
  } else if (lowerName.includes('lmr')) {
    qualityTag = 'Last Minute Revision';
  }

  // Topic detail in parentheses
  const topicMatch = fileName.match(/\(([^)]+)\)/);
  const topicHint = topicMatch ? topicMatch[1].trim() : '';

  let semester = subjectInfo?.semester || 5;
  if (lowerPath.includes('sem 3-1')) semester = 5;
  else if (lowerPath.includes('sem 3-2')) semester = 6;
  else if (lowerPath.includes('4th year')) semester = 7;

  return {
    subjectInfo,
    category,
    primaryUnit,
    unitSpan,
    qualityTag,
    topicHint,
    semester
  };
}

async function fetchFileAsPdf(file) {
  const ext = (file.ext || '').toLowerCase();
  let downloadUrl = '';

  if (ext === 'pptx' || ext === 'ppt') {
    downloadUrl = `https://docs.google.com/presentation/d/${file.id}/export/pdf`;
  } else if (ext === 'docx' || ext === 'doc') {
    downloadUrl = `https://docs.google.com/document/d/${file.id}/export?format=pdf`;
  } else {
    downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
  }

  const res = await fetch(downloadUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to fetch file: HTTP ${res.status} ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  // Validate PDF header
  const header = buffer.slice(0, 5).toString();
  if (!header.startsWith('%PDF-')) {
    throw new Error(`File is not a valid PDF: header starts with "${header}"`);
  }

  return buffer;
}

async function runCompleteMigration() {
  console.log('============================================================');
  console.log('STARTING COMPLETE R22 CSE MIGRATION (3RD & 4TH YEAR)');
  console.log('============================================================\n');

  console.log('Fetching catalog from exams.ignitext.tech/api/catalog...');
  const catRes = await fetch('https://exams.ignitext.tech/api/catalog');
  const catalog = await catRes.json();

  const allFiles = catalog.allFiles || [];
  console.log(`Loaded catalog with ${allFiles.length} total files.`);

  // Filter all R22 CSE files (both 3rd YEAR R22 and 4th YEAR R22)
  const targetFiles = allFiles.filter(f => {
    const pathStr = (f.path || []).join(' / ').toLowerCase();
    const is3rdYear = pathStr.includes('3rd year r22') || (f.year && f.year.toLowerCase().includes('3rd year r22'));
    const is4thYear = pathStr.includes('4th year r22') || (f.year && f.year.toLowerCase().includes('4th year r22'));
    return is3rdYear || is4thYear;
  });

  console.log(`Found ${targetFiles.length} target files in R22 CSE (3rd & 4th Year).\n`);

  const progress = loadProgress();
  console.log(`Previously processed: ${Object.keys(progress.processedIds).length} files.`);

  const seqTracker = {};

  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i];
    const fileNum = i + 1;

    if (progress.processedIds[file.id] && progress.processedIds[file.id].status === 'success') {
      console.log(`[${fileNum}/${targetFiles.length}] Already processed: ${file.name} (Skipping)`);
      continue;
    }

    const meta = parseItemMetadata(file);

    if (!meta.subjectInfo) {
      console.warn(`[${fileNum}/${targetFiles.length}] Could not map subject for: "${file.name}" at path: "${file.path.join(' > ')}" (Skipping)`);
      progress.processedIds[file.id] = { status: 'skipped', reason: 'unmapped_subject' };
      saveProgress(progress);
      continue;
    }

    const sub = meta.subjectInfo;
    const trackerKey = `${sub.shortCode}_${meta.category}_${meta.primaryUnit || '0'}`;
    seqTracker[trackerKey] = (seqTracker[trackerKey] || 0) + 1;
    const seq = seqTracker[trackerKey];

    // Build clean title
    let autoTitle = '';
    if (meta.category === 'note') {
      const spanStr = meta.unitSpan.length > 1 ? ` (Units ${meta.unitSpan.join(', ')})` : '';
      const topicStr = meta.topicHint ? ` (${meta.topicHint})` : '';
      autoTitle = `${sub.shortCode} Unit-${meta.primaryUnit}-${seq}${spanStr}${topicStr}`;
    } else if (meta.category === 'pyq') {
      const lowerF = file.name.toLowerCase();
      let typeStr = 'SEM Exam';
      if (lowerF.includes('mid') || lowerF.includes('4-1  mid paper')) typeStr = 'Mid Paper';
      autoTitle = `${sub.shortCode} PYQ-${seq} (${typeStr})`;
    } else {
      const topicStr = meta.topicHint || (file.name.toLowerCase().includes('mid') ? 'Mid Topics' : 'Important Questions');
      autoTitle = `${sub.shortCode} IMP-${seq} (${topicStr})`;
    }

    // Target R2 Key: CSE/R22/${semester}/${shortCode}/${cleanFileName}.pdf
    const cleanFileName = autoTitle.replace(/[\s/\\?%*:|"<>]+/g, '_');
    const r2Key = `CSE/R22/${meta.semester}/${sub.shortCode}/${cleanFileName}.pdf`;

    console.log(`\n------------------------------------------------------------`);
    console.log(`[${fileNum}/${targetFiles.length}] Processing: "${file.name}" (${file.ext})`);
    console.log(`Path:           ${file.path.join(' > ')}`);
    console.log(`Mapped Subject: [${sub.shortCode}] ${sub.name} (Sem ${meta.semester})`);
    console.log(`Clean Title:    ${autoTitle}`);
    console.log(`Category:       ${meta.category.toUpperCase()} | Unit: ${meta.primaryUnit || 'N/A'}`);
    console.log(`Target R2 Key:  ${r2Key}`);

    try {
      // 1. Download & convert to PDF
      process.stdout.write(`Downloading and converting to PDF... `);
      const pdfBuffer = await fetchFileAsPdf(file);
      const sizeKb = Math.round(pdfBuffer.length / 1024);
      console.log(`OK (${sizeKb} KB, valid %PDF-)`);

      // 2. Upload to Cloudflare R2
      process.stdout.write(`Uploading to Cloudflare R2 bucket "${process.env.R2_BUCKET_NAME}"... `);
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }));
      console.log(`OK`);

      // 3. Insert primary record into Supabase content_items
      process.stdout.write(`Publishing to Supabase content_items... `);
      const dbType = meta.category === 'pyq' ? 'pyq' : 'note';
      const { data: dbData, error: dbError } = await supabase
        .from('content_items')
        .insert({
          subject_id: sub.id,
          uploaded_by: 'e3c93c4f-bc31-4bc9-9bc6-7d897fa6e0d5', // superadmin
          type: dbType,
          title: autoTitle,
          unit_number: dbType === 'note' ? (meta.primaryUnit || 1) : null,
          unit_title: meta.topicHint || (meta.category === 'imp' ? 'Important Topics' : null),
          exam_year: meta.category === 'pyq' ? 2024 : null,
          file_url: r2Key,
          file_size_kb: sizeKb,
          status: 'published'
        })
        .select()
        .single();

      if (dbError) throw dbError;
      console.log(`OK (ID: ${dbData.id})`);

      // 4. If multi-unit (e.g. Unit 1, 2, 3), also insert entry for other units pointing to same R2 key
      if (meta.category === 'note' && meta.unitSpan.length > 1) {
        for (let u = 1; u < meta.unitSpan.length; u++) {
          const secondaryUnit = meta.unitSpan[u];
          const secondaryTitle = `${sub.shortCode} Unit-${secondaryUnit}-${seq} (Units ${meta.unitSpan.join(', ')})`;
          try {
            await supabase.from('content_items').insert({
              subject_id: sub.id,
              uploaded_by: 'e3c93c4f-bc31-4bc9-9bc6-7d897fa6e0d5',
              type: 'note',
              title: secondaryTitle,
              unit_number: secondaryUnit,
              unit_title: `Multi-unit note (${meta.unitSpan.join(', ')})`,
              file_url: r2Key,
              file_size_kb: sizeKb,
              status: 'published'
            });
            console.log(`  + Also indexed under Unit ${secondaryUnit} as "${secondaryTitle}"`);
          } catch (secErr) {
            console.warn(`  ! Note: could not add secondary index for Unit ${secondaryUnit}: ${secErr.message}`);
          }
        }
      }

      progress.processedIds[file.id] = {
        status: 'success',
        title: autoTitle,
        r2Key,
        sizeKb,
        processedAt: new Date().toISOString()
      };
      progress.stats.success += 1;
      saveProgress(progress);

    } catch (err) {
      console.error(`\nFAILED to process "${file.name}":`, err.message);
      progress.processedIds[file.id] = {
        status: 'failed',
        error: err.message,
        failedAt: new Date().toISOString()
      };
      progress.stats.failed += 1;
      saveProgress(progress);
    }
  }

  console.log(`\n============================================================`);
  console.log(`COMPLETE R22 MIGRATION RUN FINISHED!`);
  console.log(`Success: ${progress.stats.success}`);
  console.log(`Failed:  ${progress.stats.failed}`);
  console.log(`Skipped: ${progress.stats.skipped}`);
  console.log(`============================================================\n`);
}

runCompleteMigration().catch(console.error);

import fs from 'node:fs';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const apkPath = process.argv[2] || 'c:/IgniteXT/android/app/build/outputs/apk/release/app-release.apk';
const r2Key = 'releases/SemKit.apk';
const bucket = process.env.R2_BUCKET_NAME || 'ignitext-pdfs';
const r2PublicBase = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev'
).replace(/\/+$/, '');

if (!fs.existsSync(apkPath)) {
  console.error('APK not found at:', apkPath);
  process.exit(1);
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const body = fs.readFileSync(apkPath);
console.log(`Uploading ${apkPath} (${(body.length / 1048576).toFixed(2)} MB) to R2 key "${r2Key}"...`);

await r2.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: r2Key,
    Body: body,
    ContentType: 'application/vnd.android.package-archive',
    ContentDisposition: 'attachment; filename="SemKit.apk"',
    CacheControl: 'public, max-age=3600',
  }),
);

const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
console.log('R2 object verified:', {
  key: r2Key,
  bytes: head.ContentLength,
  contentType: head.ContentType,
  contentDisposition: head.ContentDisposition,
  publicUrl: `${r2PublicBase}/${r2Key}`,
});

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'e26a934b9c861be7641fd7b33de5292b';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '51986c15b3f5f575499d647e00240d1a';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'fa86d3937b41d132b62aeef06cd5e365b454626410466a87e925ddeaf1f01870';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ignitext-pdfs';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffmioulgyhpsqxodfths.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWlvdWxneWhwc3F4b2RmdGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjYwMjM2NywiZXhwIjoyMTAyMTc4MzY3fQ.GGy0xllj7k6XEHpK5OC1gnhOnqAtXGd2BWyFWoWma4o';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const subjectId = formData.get('subjectId') as string;
    const materialType = (formData.get('materialType') as string) || 'notes';
    const unitNumberStr = formData.get('unitNumber') as string | null;
    const unitTitle = formData.get('unitTitle') as string | null;
    const examYearStr = formData.get('examYear') as string | null;
    const userId = (formData.get('userId') as string) || 'e3c93c4f-bc31-4bc9-9bc6-7d897fa6e0d5';
    const autoTitle = formData.get('autoTitle') as string;
    const cleanR2Path = formData.get('cleanR2Path') as string;

    if (!file || !subjectId || !autoTitle || !cleanR2Path) {
      return NextResponse.json(
        { error: 'Missing required upload parameters (file, subjectId, autoTitle, cleanR2Path)' },
        { status: 400, headers: corsHeaders }
      );
    }

    const unitNumber = unitNumberStr ? parseInt(unitNumberStr, 10) : null;
    const examYear = examYearStr ? parseInt(examYearStr, 10) : null;
    const categoryType = materialType === 'notes' ? 'note' : materialType === 'pyq' ? 'pyq' : 'imp';

    // 1. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const fileSizeKb = Math.round(fileBuffer.length / 1024);

    // 2. Upload directly to Cloudflare R2 via Node.js S3 Client (Server-to-Server, zero CORS issue)
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: cleanR2Path,
        Body: fileBuffer,
        ContentType: file.type || 'application/pdf',
      })
    );

    // 3. Insert record into Supabase content_items table as 'published'
    const { data: dbData, error: dbError } = await supabase
      .from('content_items')
      .insert({
        subject_id: subjectId,
        uploaded_by: userId,
        type: categoryType,
        title: autoTitle,
        unit_number: categoryType === 'note' ? unitNumber : null,
        unit_title: categoryType === 'note' ? (unitTitle || null) : null,
        exam_year: categoryType === 'pyq' ? (examYear || new Date().getFullYear()) : null,
        file_url: cleanR2Path,
        file_size_kb: fileSizeKb,
        status: 'published',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return NextResponse.json(
        { error: `Database insert failed: ${dbError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Log admin activity
    await supabase.from('admin_activity_log').insert({
      admin_id: userId,
      action: 'UPLOAD_CONTENT',
      target_type: 'content_items',
      target_id: dbData.id,
      meta: { title: autoTitle, subject_id: subjectId, r2_key: cleanR2Path }
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        item: dbData,
        title: autoTitle,
        r2Key: cleanR2Path,
        publicUrl: `https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev/${cleanR2Path}`,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Server upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server upload error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

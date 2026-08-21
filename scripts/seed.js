require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedTestData() {
  console.log('🌱 Seeding test data...');

  // 1. Get a subject to attach notes to
  const { data: subjects, error: subErr } = await supabase.from('subjects').select('id, name, code').limit(1);
  if (subErr || !subjects.length) {
    console.error('❌ Please run schema.sql in Supabase first! No subjects found.');
    return;
  }
  const subject = subjects[0];
  console.log(`📌 Found Subject: ${subject.name} (${subject.code})`);

  // 2. Create a dummy uploader user via Admin API
  const dummyEmail = 'admin@ignitext.test';
  let userId;

  const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
    email: dummyEmail,
    password: 'password123',
    email_confirm: true,
  });

  if (adminErr) {
    if (adminErr.message.includes('already exists') || adminErr.status === 422) {
      // If user exists, fetch their ID
      const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', dummyEmail).single();
      if (existingUser) {
        userId = existingUser.id;
      }
    } else {
      console.error('❌ Failed to create auth user:', adminErr);
    }
  } else if (adminData?.user) {
    userId = adminData.user.id;
    // Update profile role
    await supabase.from('profiles').update({ role: 'superadmin', full_name: 'Admin Tester' }).eq('id', userId);
  }

  if (!userId) {
    console.error('❌ Failed to setup test user.');
    return;
  }
  
  const dummyUserId = userId;

  // 3. Insert Dummy Notes
  const notes = [
    {
      title: `${subject.code} — Unit 1: Introduction`,
      type: 'note',
      subject_id: subject.id,
      uploaded_by: dummyUserId,
      unit_number: 1,
      unit_title: 'Introduction & Basics',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // valid dummy pdf
      file_size_kb: 1450,
      status: 'published',
      download_count: 342
    },
    {
      title: `${subject.code} — Unit 2: Advanced Concepts`,
      type: 'note',
      subject_id: subject.id,
      uploaded_by: dummyUserId,
      unit_number: 2,
      unit_title: 'Advanced Concepts',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      file_size_kb: 2100,
      status: 'published',
      download_count: 156
    }
  ];

  // 4. Insert Dummy PYQs
  const pyqs = [
    {
      title: `${subject.code} — 2023 Semester Exam`,
      type: 'pyq',
      subject_id: subject.id,
      uploaded_by: dummyUserId,
      exam_type: 'semester',
      exam_year: 2023,
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      file_size_kb: 800,
      status: 'published',
      download_count: 890
    },
    {
      title: `${subject.code} — 2024 Mid 1`,
      type: 'pyq',
      subject_id: subject.id,
      uploaded_by: dummyUserId,
      exam_type: 'mid1',
      exam_year: 2024,
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      file_size_kb: 450,
      status: 'published',
      download_count: 120
    }
  ];

  const { error: insErr } = await supabase.from('content_items').insert([...notes, ...pyqs]);
  
  if (insErr) {
    console.error('❌ Error inserting test content:', insErr);
  } else {
    console.log('✅ Test Data Seeded Successfully!');
    console.log('👉 Go to your app and check the Home page and Subject page to see the notes.');
  }
}

seedTestData();

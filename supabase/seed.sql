-- ============================================================
-- IGNITEXT — DUMMY TEST DATA SEED
-- Paste this into your Supabase SQL Editor and click RUN
-- ============================================================

-- 1. Create a dummy user directly in auth.users
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES 
('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@ignitext.test', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Create the profile for the dummy user
INSERT INTO public.profiles (id, full_name, email, role, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Admin Tester', 'admin@ignitext.test', 'superadmin', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Dummy Notes and PYQs into the first available subject
DO $$
DECLARE
  v_subject_id UUID;
BEGIN
  -- Get the first subject ID
  SELECT id INTO v_subject_id FROM public.subjects LIMIT 1;
  
  IF v_subject_id IS NOT NULL THEN
    -- Insert Notes
    INSERT INTO public.content_items (title, type, subject_id, uploaded_by, unit_number, unit_title, file_url, file_size_kb, status, download_count)
    VALUES 
    ('Unit 1: Introduction to Data Structures', 'note', v_subject_id, '11111111-1111-1111-1111-111111111111', 1, 'Introduction & Basics', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 1450, 'published', 342),
    ('Unit 2: Trees and Graphs', 'note', v_subject_id, '11111111-1111-1111-1111-111111111111', 2, 'Advanced Concepts', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 2100, 'published', 156)
    ON CONFLICT DO NOTHING;

    -- Insert PYQs
    INSERT INTO public.content_items (title, type, subject_id, uploaded_by, exam_type, exam_year, file_url, file_size_kb, status, download_count)
    VALUES 
    ('2023 Semester Exam Paper', 'pyq', v_subject_id, '11111111-1111-1111-1111-111111111111', 'semester', 2023, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 800, 'published', 890),
    ('2024 Mid 1 Paper', 'pyq', v_subject_id, '11111111-1111-1111-1111-111111111111', 'mid1', 2024, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 450, 'published', 120)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

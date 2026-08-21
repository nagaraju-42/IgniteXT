-- ============================================================
-- IGNITEXT — MASSIVE TEST DATA SEED
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

-- 3. Make sure Regulations exist
INSERT INTO public.regulations (code, label, sort_order) VALUES
('R18', 'Regulation 2018', 1),
('R20', 'Regulation 2020', 2),
('R22', 'Regulation 2022', 3),
('R23', 'Regulation 2023', 4)
ON CONFLICT DO NOTHING;

-- 4. Make sure Branches exist
INSERT INTO public.branches (code, label, sort_order) VALUES
('CSE', 'Computer Science', 1),
('ECE', 'Electronics & Comm', 2),
('EEE', 'Electrical & Electronics', 3),
('IT', 'Information Technology', 4)
ON CONFLICT DO NOTHING;

-- 5. Insert bulk subjects
DO $$
DECLARE
  v_r20 UUID;
  v_r22 UUID;
  v_cse UUID;
  v_ece UUID;
BEGIN
  SELECT id INTO v_r20 FROM public.regulations WHERE code = 'R20';
  SELECT id INTO v_r22 FROM public.regulations WHERE code = 'R22';
  SELECT id INTO v_cse FROM public.branches WHERE code = 'CSE';
  SELECT id INTO v_ece FROM public.branches WHERE code = 'ECE';

  -- R20 CSE Subjects
  IF v_r20 IS NOT NULL AND v_cse IS NOT NULL THEN
    INSERT INTO public.subjects (regulation_id, branch_id, semester, code, name, total_units, is_active) VALUES
    (v_r20, v_cse, 5, 'CS501', 'Software Engineering', 5, true),
    (v_r20, v_cse, 5, 'CS502', 'Computer Networks', 5, true),
    (v_r20, v_cse, 5, 'CS503', 'Web Technologies', 5, true),
    (v_r20, v_cse, 6, 'CS601', 'Machine Learning', 5, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- R20 ECE Subjects
  IF v_r20 IS NOT NULL AND v_ece IS NOT NULL THEN
    INSERT INTO public.subjects (regulation_id, branch_id, semester, code, name, total_units, is_active) VALUES
    (v_r20, v_ece, 5, 'EC501', 'Digital Signal Processing', 5, true),
    (v_r20, v_ece, 5, 'EC502', 'Microprocessors', 5, true)
    ON CONFLICT DO NOTHING;
  END IF;

END $$;

-- 6. Insert Dummy Notes and PYQs into ALL subjects
DO $$
DECLARE
  sub RECORD;
BEGIN
  FOR sub IN SELECT id, code FROM public.subjects LOOP
    -- Insert Notes
    INSERT INTO public.content_items (title, type, subject_id, uploaded_by, unit_number, unit_title, file_url, file_size_kb, status, download_count)
    VALUES 
    (sub.code || ' Unit 1 Notes', 'note', sub.id, '11111111-1111-1111-1111-111111111111', 1, 'Introduction', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 1450, 'published', floor(random() * 500)),
    (sub.code || ' Unit 2 Notes', 'note', sub.id, '11111111-1111-1111-1111-111111111111', 2, 'Core Concepts', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 2100, 'published', floor(random() * 500))
    ON CONFLICT DO NOTHING;

    -- Insert PYQs
    INSERT INTO public.content_items (title, type, subject_id, uploaded_by, exam_type, exam_year, file_url, file_size_kb, status, download_count)
    VALUES 
    (sub.code || ' 2023 Semester Paper', 'pyq', sub.id, '11111111-1111-1111-1111-111111111111', 'semester', 2023, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 800, 'published', floor(random() * 500))
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

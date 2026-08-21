-- ============================================================
-- IGNITEXT — HARDCODE SUPERADMIN & COMMUNITY ADMIN
-- Run this in your Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  v_sa_id UUID;
  v_ca_id UUID;
BEGIN
  -- 1. CLEANUP (If you ran the previous script, this fixes the login issue)
  UPDATE auth.users 
  SET aud = 'authenticated', role = 'authenticated'
  WHERE aud IS NULL;

  -- 2. CREATE SUPERADMIN (bigguysolution@gmail.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bigguysolution@gmail.com') THEN
    v_sa_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      v_sa_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bigguysolution@gmail.com', 
      crypt('Supabase@2027', gen_salt('bf')), NOW(), 
      '{"provider":"email","providers":["email"]}', '{"full_name": "Super Admin"}', NOW(), NOW(), '', '', '', ''
    );
    UPDATE public.profiles SET role = 'superadmin', status = 'active' WHERE id = v_sa_id;
  ELSE
    UPDATE public.profiles SET role = 'superadmin', status = 'active' WHERE email = 'bigguysolution@gmail.com';
    UPDATE auth.users SET aud = 'authenticated', role = 'authenticated' WHERE email = 'bigguysolution@gmail.com';
  END IF;

  -- 3. CREATE COMMUNITY ADMIN (community@ignitext.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'community@ignitext.com') THEN
    v_ca_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      v_ca_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'community@ignitext.com', 
      crypt('Supabase@2027', gen_salt('bf')), NOW(), 
      '{"provider":"email","providers":["email"]}', '{"full_name": "Community Admin"}', NOW(), NOW(), '', '', '', ''
    );
    -- We set this one to 'pending' so you can test your Superadmin approval flow!
    UPDATE public.profiles SET role = 'community_admin', status = 'pending', college = 'Anurag University' WHERE id = v_ca_id;
  END IF;

END $$;

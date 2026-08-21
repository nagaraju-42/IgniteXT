-- ============================================================
-- IGNITEXT — 03_HARDCODE_SUPERADMIN & FIX TRIGGER
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. FIX THE SIGNUP TRIGGER ERROR
-- The "Database error saving new user" happens because the trigger fails on insert.
-- This ensures the trigger runs safely with the correct search path and columns.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'community_admin',
    'pending'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. HARDCODE THE SUPERADMIN ACCOUNT
-- This directly injects the user into auth.users with the encrypted password,
-- bypassing the UI and the need to sign up entirely.
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bigguysolution@gmail.com') THEN
    v_user_id := gen_random_uuid();
    
    -- Insert directly into Supabase Auth
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'bigguysolution@gmail.com', 
      crypt('Supabase@2027', gen_salt('bf')), NOW(), 
      '{"provider":"email","providers":["email"]}', '{"full_name": "Nagaraju"}', NOW(), NOW(),
      '', '', '', ''
    );

    -- The trigger above will automatically create a 'pending' profile.
    -- We immediately promote it to 'superadmin' and 'active'.
    UPDATE public.profiles 
    SET role = 'superadmin', status = 'active'
    WHERE id = v_user_id;

  ELSE
    -- If they somehow already exist, just forcefully promote them
    UPDATE public.profiles 
    SET role = 'superadmin', status = 'active'
    WHERE email = 'bigguysolution@gmail.com';
  END IF;
END $$;

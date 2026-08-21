-- Save this as supabase/migrations/02_clear_dummy_data.sql or run it in the SQL Editor

-- Disable RLS temporarily to allow truncation if needed, though superuser usually bypasses it
-- Be VERY CAREFUL: This drops all your taxonomy and content data, but keeps user profiles.

TRUNCATE TABLE content_items CASCADE;
TRUNCATE TABLE subjects CASCADE;
TRUNCATE TABLE branches CASCADE;
TRUNCATE TABLE regulations CASCADE;
TRUNCATE TABLE universities CASCADE;

-- If you also want to delete all pending community admins but keep your own superadmin account, 
-- you can run this (replace 'your_email@example.com' with your actual login email):
-- DELETE FROM profiles WHERE email != 'your_email@example.com';

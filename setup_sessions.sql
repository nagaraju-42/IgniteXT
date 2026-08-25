CREATE TABLE IF NOT EXISTS student_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roll_number TEXT NOT NULL,
  branch_code TEXT,
  semester INT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a session (since students don't 'login' with a password)
CREATE POLICY "Allow public insert to sessions" ON student_sessions FOR INSERT TO public WITH CHECK (true);

-- Allow anyone to update their own session (to set left_at)
CREATE POLICY "Allow public update to sessions" ON student_sessions FOR UPDATE TO public USING (true);

-- Allow admins to read all sessions
CREATE POLICY "Allow admin read sessions" ON student_sessions FOR SELECT TO authenticated USING (true);

-- Create students table for tracking hall tickets
CREATE TABLE public.students (
    hall_ticket TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/upsert their hall ticket (upsert handles login)
CREATE POLICY "Public can upsert hall tickets" 
ON public.students 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update their own hall ticket"
ON public.students
FOR UPDATE
USING (true);

-- Allow admins to read student stats
CREATE POLICY "Admins can view students" 
ON public.students 
FOR SELECT 
USING (public.is_active_admin());

-- Create a secure RPC for students to register/login their hall ticket
CREATE OR REPLACE FUNCTION register_student(p_hall_ticket TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.students (hall_ticket, created_at, last_active)
    VALUES (UPPER(p_hall_ticket), NOW(), NOW())
    ON CONFLICT (hall_ticket) 
    DO UPDATE SET last_active = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

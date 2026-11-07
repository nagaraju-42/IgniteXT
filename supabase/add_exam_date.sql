-- Add exam_date and exam_time to subjects table
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS exam_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS exam_time TEXT DEFAULT NULL;

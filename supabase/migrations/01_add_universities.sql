-- ============================================================
-- IGNITEXT — 01_ADD_UNIVERSITIES (ADVANCED SCHEMA)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the universities table (Future-proofed)
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,       -- e.g., 'AU', 'JNTUH'
  name TEXT NOT NULL,              -- e.g., 'Anurag University'
  location TEXT,                   -- e.g., 'Hyderabad, Telangana'
  logo_url TEXT,                   -- for future UI
  website TEXT,                    -- for future UI
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_universities" ON public.universities FOR SELECT USING (TRUE);
CREATE POLICY "sa_all_universities" ON public.universities FOR ALL USING (is_superadmin());

-- 2. Insert Base Universities
INSERT INTO public.universities (code, name, location, sort_order) VALUES
('AU', 'Anurag University', 'Hyderabad', 1),
('JNTUH', 'JNTU Hyderabad', 'Hyderabad', 2),
('OU', 'Osmania University', 'Hyderabad', 3)
ON CONFLICT (code) DO NOTHING;

-- 3. Add university_id to regulations
ALTER TABLE public.regulations 
ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id);

-- Link existing regulations to AU (Anurag) as a default fallback
DO $$
DECLARE
  v_au UUID;
BEGIN
  SELECT id INTO v_au FROM public.universities WHERE code = 'AU' LIMIT 1;
  IF v_au IS NOT NULL THEN
    UPDATE public.regulations SET university_id = v_au WHERE university_id IS NULL;
  END IF;
END $$;

-- Make it NOT NULL for future
ALTER TABLE public.regulations ALTER COLUMN university_id SET NOT NULL;

-- 4. Future-proof content_items with advanced ranking metrics
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 5. Recreate content_with_meta view to include University data
DROP VIEW IF EXISTS public.content_with_meta;

CREATE VIEW public.content_with_meta AS
SELECT
  c.id, c.title, c.type,
  c.unit_number, c.unit_title,
  c.exam_type, c.exam_year,
  c.file_url, c.drive_link, c.file_size_kb,
  c.description, c.tags, c.status,
  c.download_count, c.upvotes, c.downvotes, c.view_count, c.notes_for_students,
  c.created_at,
  s.code AS subject_code, s.name AS subject_name,
  s.semester, s.total_units,
  b.code AS branch_code, b.label AS branch_label,
  r.code AS regulation_code,
  u.id AS university_id, u.code AS university_code, u.name AS university_name,
  p.full_name AS uploader_name
FROM public.content_items c
JOIN public.subjects s ON s.id = c.subject_id
JOIN public.branches b ON b.id = s.branch_id
JOIN public.regulations r ON r.id = s.regulation_id
JOIN public.universities u ON u.id = r.university_id
JOIN public.profiles p ON p.id = c.uploaded_by
WHERE c.status = 'published';

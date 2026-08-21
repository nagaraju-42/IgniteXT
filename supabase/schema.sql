-- ============================================================
-- IGNITEXT — COMPLETE SUPABASE SQL SCHEMA
-- Paste this entire file into Supabase SQL Editor and click RUN
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES ─────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'community_admin'
                CHECK (role IN ('superadmin','community_admin')),
  department  TEXT,
  college     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','suspended')),
  avatar_url  TEXT,
  fcm_token   TEXT,        -- Firebase push notification token
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles(id, full_name, email)
  VALUES(NEW.id,
         COALESCE(NEW.raw_user_meta_data->>'full_name',''),
         NEW.email);
  RETURN NEW;
END;$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 2. REGULATIONS ──────────────────────────────────────────
CREATE TABLE regulations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO regulations(code,label,sort_order) VALUES
  ('R18','Regulation 2018',1),
  ('R20','Regulation 2020',2),
  ('R22','Regulation 2022',3),
  ('R23','Regulation 2023',4);

-- ── 3. BRANCHES ─────────────────────────────────────────────
CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO branches(code,label,sort_order) VALUES
  ('CSE' ,'Computer Science & Engineering',1),
  ('ECE' ,'Electronics & Communication',2),
  ('EEE' ,'Electrical & Electronics',3),
  ('MECH','Mechanical Engineering',4),
  ('CIVIL','Civil Engineering',5),
  ('IT'  ,'Information Technology',6),
  ('AIML','AI & Machine Learning',7),
  ('DS'  ,'Data Science',8);

-- ── 4. SUBJECTS ─────────────────────────────────────────────
CREATE TABLE subjects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  regulation_id UUID NOT NULL REFERENCES regulations(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  semester      INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  total_units   INTEGER DEFAULT 5,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, regulation_id, branch_id)
);

-- Sample R22 CSE subjects
INSERT INTO subjects(code,name,regulation_id,branch_id,semester,total_units)
SELECT s.code, s.name, r.id, b.id, s.sem, s.units
FROM (VALUES
  ('CS301','Data Structures',3,5),
  ('CS302','Operating Systems',3,5),
  ('CS303','Digital Logic Design',3,4),
  ('CS304','OOP Through Java',3,5),
  ('CS305','Discrete Mathematics',3,5),
  ('CS306','Software Engineering',3,4),
  ('CS401','DBMS',4,5),
  ('CS402','Computer Networks',4,5),
  ('CS403','Design & Analysis of Algorithms',4,5),
  ('CS404','Compiler Design',4,5),
  ('CS501','Machine Learning',5,5),
  ('CS502','Web Technologies',5,4)
) AS s(code,name,sem,units)
CROSS JOIN regulations r
CROSS JOIN branches b
WHERE r.code='R22' AND b.code='CSE';

-- ── 5. CONTENT ITEMS (core table) ───────────────────────────
CREATE TABLE content_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('note','pyq')),
  subject_id      UUID NOT NULL REFERENCES subjects(id),
  uploaded_by     UUID NOT NULL REFERENCES profiles(id),
  -- Notes fields
  unit_number     INTEGER CHECK (unit_number BETWEEN 1 AND 10),
  unit_title      TEXT,
  -- PYQ fields
  exam_type       TEXT CHECK (exam_type IN ('mid1','mid2','semester','supplementary')),
  exam_year       INTEGER,
  -- File
  file_url        TEXT,         -- Cloudflare R2 public URL
  drive_link      TEXT,         -- fallback Google Drive link
  file_size_kb    INTEGER,
  -- Meta
  description     TEXT,
  tags            TEXT[],
  notes_for_students TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','flagged','removed')),
  download_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ci_subject   ON content_items(subject_id);
CREATE INDEX idx_ci_status    ON content_items(status);
CREATE INDEX idx_ci_uploader  ON content_items(uploaded_by);
CREATE INDEX idx_ci_downloads ON content_items(download_count DESC);

-- ── 6. DOWNLOAD LOGS ────────────────────────────────────────
CREATE TABLE download_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id   UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_agent   TEXT,
  ip_hash      TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dl_content ON download_logs(content_id);
CREATE INDEX idx_dl_date    ON download_logs(downloaded_at DESC);

-- Auto increment download count
CREATE OR REPLACE FUNCTION increment_download_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE content_items SET download_count = download_count + 1 WHERE id = NEW.content_id;
  RETURN NEW;
END;$$;

CREATE TRIGGER on_download_logged
  AFTER INSERT ON download_logs
  FOR EACH ROW EXECUTE FUNCTION increment_download_count();

-- ── 7. CONTENT REQUESTS ─────────────────────────────────────
CREATE TABLE content_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID REFERENCES subjects(id),
  request_text  TEXT NOT NULL,
  type          TEXT CHECK (type IN ('note','pyq')),
  unit_number   INTEGER,
  exam_type     TEXT,
  exam_year     INTEGER,
  request_count INTEGER DEFAULT 1,
  status        TEXT DEFAULT 'open'
                  CHECK (status IN ('open','claimed','fulfilled','closed')),
  claimed_by    UUID REFERENCES profiles(id),
  fulfilled_by  UUID REFERENCES content_items(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. ANNOUNCEMENTS ────────────────────────────────────────
CREATE TABLE announcements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  posted_by         UUID NOT NULL REFERENCES profiles(id),
  priority          TEXT DEFAULT 'normal'
                      CHECK (priority IN ('normal','urgent','info')),
  target_branch     TEXT,
  target_regulation TEXT,
  send_notification BOOLEAN DEFAULT TRUE,   -- triggers FCM push
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);

CREATE INDEX idx_ann_active  ON announcements(is_active);
CREATE INDEX idx_ann_created ON announcements(created_at DESC);

-- ── 9. NOTIFICATIONS LOG ────────────────────────────────────
-- Track all push notifications sent (for dedup + history)
CREATE TABLE notification_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  type         TEXT CHECK (type IN ('announcement','new_content','system')),
  ref_id       UUID,          -- announcement_id or content_item_id
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  sent_count   INTEGER DEFAULT 0
);

-- ── 10. MODERATION FLAGS ────────────────────────────────────
CREATE TABLE moderation_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id  UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  flag_count  INTEGER DEFAULT 1,
  status      TEXT DEFAULT 'open'
                CHECK (status IN ('open','resolved','rejected')),
  resolved_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ── 11. ADMIN ACTIVITY LOG ──────────────────────────────────
CREATE TABLE admin_activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES profiles(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. PLATFORM SETTINGS ───────────────────────────────────
CREATE TABLE platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings(key,value,description) VALUES
  ('upi_id',               'ignitext@okhdfcbank', 'UPI tip jar ID on download sheet'),
  ('show_tip_jar',         'true',                'Show UPI tip jar toggle'),
  ('fcm_server_key',       '',                    'Firebase Cloud Messaging server key for push'),
  ('admob_banner_id',      '',                    'AdMob Banner Ad Unit ID'),
  ('admob_interstitial_id','',                    'AdMob Interstitial Ad Unit ID'),
  ('max_file_size_mb',     '25',                  'Max PDF upload size MB'),
  ('app_version',          '1.0.0',               'Current live app version for auto-update check'),
  ('maintenance_mode',     'false',               'Maintenance mode toggle');

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_flags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings  ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='superadmin');
$$;

CREATE OR REPLACE FUNCTION is_active_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid()
    AND role IN ('community_admin','superadmin') AND status='active');
$$;

-- Public tables (read by everyone)
CREATE POLICY "public_read" ON regulations       FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON branches          FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON subjects          FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON announcements     FOR SELECT USING (is_active=TRUE);
CREATE POLICY "public_read" ON notification_logs FOR SELECT USING (TRUE);

-- Superadmin manages reference data
CREATE POLICY "sa_all" ON regulations  FOR ALL USING (is_superadmin());
CREATE POLICY "sa_all" ON branches     FOR ALL USING (is_superadmin());
CREATE POLICY "sa_all" ON subjects     FOR ALL USING (is_superadmin());

-- Profiles
CREATE POLICY "own_profile"  ON profiles FOR SELECT USING (auth.uid()=id OR is_superadmin());
CREATE POLICY "own_update"   ON profiles FOR UPDATE USING (auth.uid()=id);
CREATE POLICY "sa_profiles"  ON profiles FOR ALL    USING (is_superadmin());

-- Content items
CREATE POLICY "public_published" ON content_items FOR SELECT USING (status='published');
CREATE POLICY "admin_own_read"   ON content_items FOR SELECT USING (is_active_admin() AND uploaded_by=auth.uid());
CREATE POLICY "admin_insert"     ON content_items FOR INSERT WITH CHECK (is_active_admin() AND uploaded_by=auth.uid());
CREATE POLICY "admin_update"     ON content_items FOR UPDATE USING (is_active_admin() AND uploaded_by=auth.uid());
CREATE POLICY "admin_delete"     ON content_items FOR DELETE USING (is_active_admin() AND uploaded_by=auth.uid());
CREATE POLICY "sa_content"       ON content_items FOR ALL    USING (is_superadmin());

-- Downloads (public insert for tracking)
CREATE POLICY "public_dl_insert" ON download_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "admin_dl_read"    ON download_logs FOR SELECT USING (is_active_admin());

-- Requests (public)
CREATE POLICY "public_req_read"   ON content_requests FOR SELECT USING (TRUE);
CREATE POLICY "public_req_insert" ON content_requests FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "admin_req_update"  ON content_requests FOR UPDATE USING (is_active_admin());

-- Announcements
CREATE POLICY "admin_ann_insert" ON announcements FOR INSERT WITH CHECK (is_active_admin());
CREATE POLICY "admin_ann_update" ON announcements FOR UPDATE USING (is_active_admin() AND posted_by=auth.uid());
CREATE POLICY "sa_ann"           ON announcements FOR ALL   USING (is_superadmin());

-- Flags, logs, settings — superadmin only
CREATE POLICY "sa_flags"    ON moderation_flags   FOR ALL USING (is_superadmin());
CREATE POLICY "sa_logs"     ON admin_activity_log FOR ALL USING (is_superadmin());
CREATE POLICY "sa_settings" ON platform_settings  FOR ALL USING (is_superadmin());
CREATE POLICY "admin_settings_read" ON platform_settings FOR SELECT USING (is_active_admin());

-- ── ENRICHED CONTENT VIEW ───────────────────────────────────
CREATE VIEW content_with_meta AS
SELECT
  c.id, c.title, c.type,
  c.unit_number, c.unit_title,
  c.exam_type, c.exam_year,
  c.file_url, c.drive_link, c.file_size_kb,
  c.description, c.tags, c.status,
  c.download_count, c.notes_for_students,
  c.created_at,
  s.code AS subject_code, s.name AS subject_name,
  s.semester, s.total_units,
  b.code AS branch_code, b.label AS branch_label,
  r.code AS regulation_code,
  p.full_name AS uploader_name
FROM content_items c
JOIN subjects    s ON s.id=c.subject_id
JOIN branches    b ON b.id=s.branch_id
JOIN regulations r ON r.id=s.regulation_id
JOIN profiles    p ON p.id=c.uploaded_by
WHERE c.status='published';

-- ── DONE ────────────────────────────────────────────────────
-- 12 tables + 1 view created. Run this once on a fresh Supabase project.
-- Tables: profiles, regulations, branches, subjects, content_items,
--         download_logs, content_requests, announcements,
--         notification_logs, moderation_flags, admin_activity_log,
--         platform_settings

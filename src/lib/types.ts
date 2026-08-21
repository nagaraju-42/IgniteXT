// ============================================================
// IGNITEXT — Database Types (mirrors Supabase schema)
// ============================================================

export type Role = 'superadmin' | 'community_admin'
export type Status = 'pending' | 'active' | 'suspended'
export type ContentType = 'note' | 'pyq'
export type ContentStatus = 'draft' | 'published' | 'flagged' | 'removed'
export type ExamType = 'mid1' | 'mid2' | 'semester' | 'supplementary'
export type Priority = 'normal' | 'urgent' | 'info'
export type RequestStatus = 'open' | 'claimed' | 'fulfilled' | 'closed'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  department: string | null
  college: string | null
  status: Status
  avatar_url: string | null
  fcm_token: string | null
  created_at: string
  created_at: string
  updated_at: string
}

export interface University {
  id: string
  code: string        // 'AU'
  name: string        // 'Anurag University'
  location: string | null
  logo_url: string | null
  website: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Regulation {
  id: string
  code: string        // 'R22'
  label: string       // 'Regulation 2022'
  university_id: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Branch {
  id: string
  code: string        // 'CSE'
  label: string       // 'Computer Science & Engineering'
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Subject {
  id: string
  code: string        // 'CS302'
  name: string        // 'Operating Systems'
  regulation_id: string
  branch_id: string
  semester: number
  total_units: number
  is_active: boolean
  created_at: string
  // Joined fields
  regulation?: Regulation
  branch?: Branch
}

export interface ContentItem {
  id: string
  title: string
  type: ContentType
  subject_id: string
  uploaded_by: string
  // Notes
  unit_number: number | null
  unit_title: string | null
  // PYQ
  exam_type: ExamType | null
  exam_year: number | null
  // File
  file_url: string | null
  drive_link: string | null
  file_size_kb: number | null
  // Meta
  description: string | null
  tags: string[] | null
  notes_for_students: string | null
  status: ContentStatus
  download_count: number
  created_at: string
  updated_at: string
  // Joined
  subject?: Subject
  uploader?: Profile
}

// Enriched view from content_with_meta
export interface ContentWithMeta {
  id: string
  title: string
  type: ContentType
  unit_number: number | null
  unit_title: string | null
  exam_type: ExamType | null
  exam_year: number | null
  file_url: string | null
  drive_link: string | null
  file_size_kb: number | null
  description: string | null
  tags: string[] | null
  status: ContentStatus
  download_count: number
  upvotes: number
  downvotes: number
  view_count: number
  notes_for_students: string | null
  created_at: string
  subject_code: string
  subject_name: string
  semester: number
  total_units: number
  branch_code: string
  branch_label: string
  regulation_code: string
  university_id: string
  university_code: string
  university_name: string
  uploader_name: string
}

export interface DownloadLog {
  id: string
  content_id: string
  user_agent: string | null
  ip_hash: string | null
  downloaded_at: string
}

export interface ContentRequest {
  id: string
  subject_id: string | null
  request_text: string
  type: ContentType | null
  unit_number: number | null
  exam_type: string | null
  exam_year: number | null
  request_count: number
  status: RequestStatus
  claimed_by: string | null
  fulfilled_by: string | null
  created_at: string
  subject?: Subject
}

export interface Announcement {
  id: string
  title: string
  body: string
  posted_by: string
  priority: Priority
  target_branch: string | null
  target_regulation: string | null
  send_notification: boolean
  is_active: boolean
  created_at: string
  expires_at: string | null
  poster?: Profile
}

export interface ModerationFlag {
  id: string
  content_id: string
  reason: string
  flag_count: number
  status: 'open' | 'resolved' | 'rejected'
  resolved_by: string | null
  created_at: string
  resolved_at: string | null
  content?: ContentItem
}

export interface PlatformSettings {
  upi_id: string
  show_tip_jar: string
  fcm_server_key: string
  admob_banner_id: string
  admob_interstitial_id: string
  max_file_size_mb: string
  app_version: string
  maintenance_mode: string
}

// Browse filter state (used across student screens)
export interface BrowseFilter {
  university: string   // 'AU'
  regulation: string   // 'R22'
  branch: string       // 'CSE'
  semester: number | null
  subject_id: string | null
}

// Push notification payload
export interface PushPayload {
  title: string
  body: string
  type: 'announcement' | 'new_content' | 'system'
  ref_id?: string
  url?: string
}

// Admin dashboard stats
export interface AdminStats {
  total_uploads: number
  total_downloads: number
  pending_requests: number
  uploads_this_month: number
}

// Superadmin platform stats
export interface PlatformStats {
  students_reached: number
  total_content: number
  community_admins: number
  total_downloads: number
  pending_admin_approvals: number
  flagged_content: number
}

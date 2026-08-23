import { createClient } from './supabase/client';
import type { 
  University,
  Regulation, 
  Branch, 
  Subject, 
  ContentWithMeta,
  Profile
} from './types';

export async function getUniversities() {
  const supabase = createClient();
  const { data } = await supabase
    .from('universities')
    .select('*')
    .eq('is_active', true)
    .order('name');
  return (data || []) as University[];
}

export async function getRegulations(universityId?: string) {
  const supabase = createClient();
  let query = supabase.from('regulations').select('*').eq('is_active', true).order('sort_order');
  if (universityId) {
    query = query.eq('university_id', universityId);
  }
  const { data } = await query;
  return data || [];
}

export async function getBranches() {
  const supabase = createClient();
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return data || [];
}

export async function getSubjects(regulationId: string, branchId: string, semester: number) {
  const supabase = createClient();
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .eq('regulation_id', regulationId)
    .eq('branch_id', branchId)
    .eq('semester', semester)
    .eq('is_active', true)
    .order('name');
  return (data || []) as Subject[];
}

export async function getPopularContent() {
  const supabase = createClient();
  // We use the view content_with_meta for enriched data
  const { data } = await supabase
    .from('content_with_meta')
    .select('*')
    .order('download_count', { ascending: false })
    .limit(5);
  return (data || []) as ContentWithMeta[];
}

export async function getContentBySubject(subjectId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('content_items')
    .select(`
      *,
      subjects (
        code,
        name,
        semester,
        total_units,
        branches (code, label),
        regulations (code)
      ),
      profiles (full_name)
    `)
    .eq('subject_id', subjectId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (!data) return [];

  // Map to the ContentWithMeta shape
  return data.map((item: any) => ({
    ...item,
    subject_code: item.subjects?.code,
    subject_name: item.subjects?.name,
    semester: item.subjects?.semester,
    total_units: item.subjects?.total_units,
    branch_code: item.subjects?.branches?.code,
    branch_label: item.subjects?.branches?.label,
    regulation_code: item.subjects?.regulations?.code,
    uploader_name: item.profiles?.full_name
  })) as ContentWithMeta[];
}

export async function recordDownload(contentId: string) {
  const supabase = createClient();
  await supabase.from('download_logs').insert({
    content_id: contentId,
  });
}

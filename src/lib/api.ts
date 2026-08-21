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
    .from('content_with_meta')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false });
  return (data || []) as ContentWithMeta[];
}

export async function recordDownload(contentId: string) {
  const supabase = createClient();
  await supabase.from('download_logs').insert({
    content_id: contentId,
  });
}

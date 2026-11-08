import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanR22Content() {
  console.log('Fetching R22 regulation subjects...');
  const { data: reg, error: regErr } = await supabase
    .from('regulations')
    .select('*')
    .ilike('code', 'R22')
    .single();

  if (regErr || !reg) {
    throw new Error('Could not find R22 regulation: ' + JSON.stringify(regErr));
  }

  console.log(`Found R22 regulation ID: ${reg.id} (${reg.code} - ${reg.label})`);

  const { data: subjects, error: subErr } = await supabase
    .from('subjects')
    .select('id, name, code, semester')
    .eq('regulation_id', reg.id);

  if (subErr || !subjects) {
    throw new Error('Could not fetch subjects: ' + JSON.stringify(subErr));
  }

  console.log(`Found ${subjects.length} subjects under R22.`);
  const subjectIds = subjects.map(s => s.id);

  const { count: beforeCount, error: countErr } = await supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .in('subject_id', subjectIds);

  console.log(`Existing content_items for R22 subjects: ${beforeCount}`);

  if (beforeCount > 0) {
    console.log('Deleting all content_items for R22 subjects...');
    const { error: delErr } = await supabase
      .from('content_items')
      .delete()
      .in('subject_id', subjectIds);

    if (delErr) {
      throw new Error('Error deleting content items: ' + JSON.stringify(delErr));
    }
  }

  const { count: afterCount } = await supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .in('subject_id', subjectIds);

  console.log(`Content items for R22 subjects after deletion: ${afterCount}`);
  console.log('Successfully wiped R22 content items! Ready for clean complete migration.');
}

cleanR22Content().catch(console.error);

import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: reg, error: regErr } = await s.from('regulations').select('*');
  if (regErr) console.error('Reg error:', regErr);
  console.log('Regulations:', reg);

  const r22 = reg.find(r => (r.name || '').toLowerCase().includes('r22') || (r.code || '').toLowerCase().includes('r22'));
  console.log('R22 Regulation:', r22);

  const { data: subjects, error: subErr } = await s
    .from('subjects')
    .select('id, name, code, semester, regulation_id')
    .eq('regulation_id', r22.id)
    .order('semester');
  if (subErr) console.error('Sub error:', subErr);

  console.log(`\nTotal R22 subjects in DB: ${subjects.length}`);
  for (const sub of subjects) {
    console.log(`Sem ${sub.semester}: [${sub.code || 'NO_CODE'}] ${sub.name} (id: ${sub.id})`);
  }

  // Also check how many content_items currently exist for these subjects
  const subIds = subjects.map(x => x.id);
  const { data: items, error: itmErr } = await s
    .from('content_items')
    .select('id, subject_id, title, type')
    .in('subject_id', subIds);

  console.log(`\nTotal content_items currently for R22 subjects: ${items?.length || 0}`);
}

inspect().catch(console.error);

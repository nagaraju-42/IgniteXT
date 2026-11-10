import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { BRANCH_DEFINITIONS, SUBJECT_DEFINITIONS, mapCatalogFile } from './catalog-mapper.mjs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const UNIV_ID = 'ca094e04-c6b1-435e-8e5b-3d31e3da3774';
const REG_IDS = {
  R22: 'ef076451-61b8-4470-b093-af379706546a',
  R24: '32962eee-9a77-4aaf-8458-736872c7f259',
};

async function ensureBranches() {
  const { data: existing, error } = await sb.from('branches').select('*');
  if (error) throw error;
  const byCode = Object.fromEntries(existing.map((b) => [b.code.toUpperCase(), b]));

  for (const b of BRANCH_DEFINITIONS) {
    if (byCode[b.code]) {
      console.log(`Branch exists: ${b.code} -> ${byCode[b.code].id}`);
      continue;
    }
    const { data, error: insErr } = await sb
      .from('branches')
      .insert({ code: b.code, label: b.label, is_active: true, sort_order: b.sort_order })
      .select()
      .single();
    if (insErr) throw insErr;
    byCode[b.code] = data;
    console.log(`Branch created: ${b.code} -> ${data.id}`);
  }
  return byCode;
}

async function ensureSubjects(branchMap) {
  const { data: existing, error } = await sb.from('subjects').select('*');
  if (error) throw error;

  const subKey = (branchId, regId, code) => `${branchId}:${regId}:${code.toUpperCase()}`;
  const byKey = new Map();
  for (const s of existing) {
    byKey.set(subKey(s.branch_id, s.regulation_id, s.code), s);
  }

  const resolvedMap = {};
  let created = 0;
  let reused = 0;

  for (const def of SUBJECT_DEFINITIONS) {
    const branchId = branchMap[def.branch].id;
    const regId = REG_IDS[def.reg];
    const k = subKey(branchId, regId, def.code);
    let row = byKey.get(k);
    if (!row) {
      const { data, error: insErr } = await sb
        .from('subjects')
        .insert({
          code: def.code,
          name: def.name,
          regulation_id: regId,
          branch_id: branchId,
          semester: def.sem,
          total_units: 5,
          is_active: true,
        })
        .select()
        .single();
      if (insErr) {
        console.error('Insert subject failed:', def, insErr);
        throw insErr;
      }
      row = data;
      byKey.set(k, row);
      created++;
    } else {
      reused++;
    }
    resolvedMap[`${def.branch}:${def.reg}:${def.sem}:${def.code}`] = {
      id: row.id,
      branch: def.branch,
      reg: def.reg,
      sem: def.sem,
      code: row.code,
      name: row.name,
    };
  }

  console.log(`Subjects ready: ${created} created, ${reused} reused (${Object.keys(resolvedMap).length} total mapped keys)`);
  return resolvedMap;
}

async function verifyCatalogCoverage(resolvedMap) {
  const cat = await (await fetch('https://exams.ignitext.tech/api/catalog')).json();
  const files = cat.allFiles || [];
  let unmapped = [];
  let skipped = 0;
  let toProcess = 0;
  const countsByBucket = {};

  for (const f of files) {
    const res = mapCatalogFile(f);
    if (res.skipAlreadyMigrated) {
      skipped++;
      continue;
    }
    if (!res.targets || res.targets.length === 0) {
      unmapped.push({ id: f.id, dept: f.departmentCode, path: f.path, name: f.name });
      continue;
    }
    for (const t of res.targets) {
      const mk = `${t.branch}:${t.reg}:${t.sem}:${t.code}`;
      if (!resolvedMap[mk]) {
        unmapped.push({ id: f.id, dept: f.departmentCode, path: f.path, name: f.name, missingKey: mk });
        break;
      }
      const bucket = `${t.branch} ${t.reg} Sem${t.sem}`;
      countsByBucket[bucket] = (countsByBucket[bucket] || 0) + 1;
    }
    toProcess++;
  }

  console.log(`\nCatalog check across ${files.length} entries:`);
  console.log(`  Already-migrated CSE R22 (skipped here): ${skipped}`);
  console.log(`  Remaining to migrate: ${toProcess}`);
  console.log(`  Unmapped: ${unmapped.length}`);
  if (unmapped.length > 0) {
    console.error('UNMAPPED SAMPLES:', unmapped.slice(0, 20));
    process.exit(1);
  }
  console.log('Target file counts by Branch/Reg/Sem:');
  for (const [k, v] of Object.entries(countsByBucket).sort()) {
    console.log(`  ${k}: ${v}`);
  }
}

async function main() {
  const branches = await ensureBranches();
  const subjects = await ensureSubjects(branches);
  await verifyCatalogCoverage(subjects);
  fs.writeFileSync(
    'c:/IgniteXT/migration_taxonomy_map.json',
    JSON.stringify({ univId: UNIV_ID, regIds: REG_IDS, branches, subjects }, null, 2),
  );
  console.log('\nSaved c:/IgniteXT/migration_taxonomy_map.json cleanly!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

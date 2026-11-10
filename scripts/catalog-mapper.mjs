/**
 * Shared catalog taxonomy & file mapper for all 1,075 IgniteXT Drive catalog items
 * across CSE, AIML, IT, and DS.
 */

export const BRANCH_DEFINITIONS = [
  { code: 'CSE', label: 'Computer Science and Engineering', sort_order: 0 },
  { code: 'AIML', label: 'Artificial Intelligence and Machine Learning', sort_order: 1 },
  { code: 'IT', label: 'Information Technology', sort_order: 2 },
  { code: 'DS', label: 'Data Science', sort_order: 3 },
];

export const SUBJECT_DEFINITIONS = [
  // ── CSE R24 Sem 1 & Sem 2 (1st Year) ──
  { branch: 'CSE', reg: 'R24', sem: 1, code: 'LAC', name: 'Linear Algebra and Calculus' },
  { branch: 'CSE', reg: 'R24', sem: 1, code: 'EC', name: 'Engineering Chemistry' },
  { branch: 'CSE', reg: 'R24', sem: 1, code: 'PIC', name: 'Programming in C' },
  { branch: 'CSE', reg: 'R24', sem: 1, code: 'BEEE', name: 'Basic Electrical and Electronics Engineering' },
  { branch: 'CSE', reg: 'R24', sem: 2, code: 'ODENT', name: 'Ordinary Differential Equations and Numerical Techniques' },
  { branch: 'CSE', reg: 'R24', sem: 2, code: 'EP', name: 'Engineering Physics' },
  { branch: 'CSE', reg: 'R24', sem: 2, code: 'DS', name: 'Data Structures' },
  { branch: 'CSE', reg: 'R24', sem: 2, code: 'EELS', name: 'English for Enhancing Leadership Skills' },

  // ── CSE R24 Sem 3 & Sem 4 (2nd Year) ──
  { branch: 'CSE', reg: 'R24', sem: 3, code: 'ADS', name: 'Advanced Data Structures' },
  { branch: 'CSE', reg: 'R24', sem: 3, code: 'COA', name: 'Computer Organization and Architecture' },
  { branch: 'CSE', reg: 'R24', sem: 3, code: 'DM', name: 'Discrete Mathematics' },
  { branch: 'CSE', reg: 'R24', sem: 3, code: 'JAVA', name: 'Object Oriented Programming through Java' },
  { branch: 'CSE', reg: 'R24', sem: 3, code: 'PYTHON', name: 'Python Programming' },
  { branch: 'CSE', reg: 'R24', sem: 4, code: 'COSM', name: 'Computer Oriented Statistical Methods' },
  { branch: 'CSE', reg: 'R24', sem: 4, code: 'DBMS', name: 'Database Management Systems' },
  { branch: 'CSE', reg: 'R24', sem: 4, code: 'FCA', name: 'Fundamentals of Computer Algorithms' },
  { branch: 'CSE', reg: 'R24', sem: 4, code: 'SE', name: 'Software Engineering' },
  { branch: 'CSE', reg: 'R24', sem: 4, code: 'WT', name: 'Web Technologies' },

  // ── CSE R24 Sem 5 (3rd Year) ──
  { branch: 'CSE', reg: 'R24', sem: 5, code: 'ACA', name: 'Advanced Computer Algorithms' },
  { branch: 'CSE', reg: 'R24', sem: 5, code: 'AIML', name: 'Artificial Intelligence and Machine Learning' },
  { branch: 'CSE', reg: 'R24', sem: 5, code: 'OS', name: 'Operating Systems' },

  // ── AIML R24 Sem 1 & Sem 2 (1st Year) ──
  { branch: 'AIML', reg: 'R24', sem: 1, code: 'LAC', name: 'Linear Algebra and Calculus' },
  { branch: 'AIML', reg: 'R24', sem: 1, code: 'EC', name: 'Engineering Chemistry' },
  { branch: 'AIML', reg: 'R24', sem: 1, code: 'PIC', name: 'Programming in C' },
  { branch: 'AIML', reg: 'R24', sem: 1, code: 'BEEE', name: 'Basic Electrical and Electronics Engineering' },
  { branch: 'AIML', reg: 'R24', sem: 2, code: 'ODENT', name: 'Ordinary Differential Equations and Numerical Techniques' },
  { branch: 'AIML', reg: 'R24', sem: 2, code: 'EP', name: 'Engineering Physics' },
  { branch: 'AIML', reg: 'R24', sem: 2, code: 'DS', name: 'Data Structures' },
  { branch: 'AIML', reg: 'R24', sem: 2, code: 'EELS', name: 'English for Enhancing Leadership Skills' },

  // ── AIML R24 Sem 3 & Sem 4 (2nd Year) ──
  { branch: 'AIML', reg: 'R24', sem: 3, code: 'ADS', name: 'Advanced Data Structures' },
  { branch: 'AIML', reg: 'R24', sem: 3, code: 'PP', name: 'Python Programming' },
  { branch: 'AIML', reg: 'R24', sem: 3, code: 'AI', name: 'Artificial Intelligence' },
  { branch: 'AIML', reg: 'R24', sem: 3, code: 'COA', name: 'Computer Organization and Architecture' },
  { branch: 'AIML', reg: 'R24', sem: 3, code: 'COSM', name: 'Computer Oriented Statistical Methods' },
  { branch: 'AIML', reg: 'R24', sem: 4, code: 'EML', name: 'Essentials of Machine Learning' },
  { branch: 'AIML', reg: 'R24', sem: 4, code: 'JAVA', name: 'Java Programming' },
  { branch: 'AIML', reg: 'R24', sem: 4, code: 'DBMS', name: 'Database Management Systems' },
  { branch: 'AIML', reg: 'R24', sem: 4, code: 'DAA', name: 'Design and Analysis of Algorithms' },
  { branch: 'AIML', reg: 'R24', sem: 4, code: 'DM', name: 'Discrete Mathematics' },

  // ── AIML R22 Sem 5 & Sem 6 (3rd Year) ──
  { branch: 'AIML', reg: 'R22', sem: 5, code: 'EML', name: 'Essentials of Machine Learning' },
  { branch: 'AIML', reg: 'R22', sem: 5, code: 'CS', name: 'Computer Systems II' },
  { branch: 'AIML', reg: 'R22', sem: 5, code: 'WPM', name: 'Web Programming with MEAN' },
  { branch: 'AIML', reg: 'R22', sem: 5, code: 'ED', name: 'Entrepreneurship Development' },
  { branch: 'AIML', reg: 'R22', sem: 5, code: 'QAR', name: 'Quantitative Aptitude and Reasoning' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'ATA', name: 'Automata Theory and Applications' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'WDM', name: 'Web Data Mining' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'CVIP', name: 'Computer Vision and Image Processing' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'RP', name: 'R Programming' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'CRYPTO', name: 'Cryptography' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'IRS', name: 'Information Retrieval Systems' },
  { branch: 'AIML', reg: 'R22', sem: 6, code: 'TBCS', name: 'Technical and Business Communication Skills' },

  // ── AIML R22 Sem 7 (4th Year) ──
  { branch: 'AIML', reg: 'R22', sem: 7, code: 'BD', name: 'Big Data' },
  { branch: 'AIML', reg: 'R22', sem: 7, code: 'CC', name: 'Cloud Computing' },
  { branch: 'AIML', reg: 'R22', sem: 7, code: 'CYBER', name: 'Cyber Security' },
  { branch: 'AIML', reg: 'R22', sem: 7, code: 'DL', name: 'Deep Learning' },
  { branch: 'AIML', reg: 'R22', sem: 7, code: 'NLP', name: 'Natural Language Processing' },
  { branch: 'AIML', reg: 'R22', sem: 7, code: 'NS', name: 'Negotiation Skills' },

  // ── IT R24 Sem 1 & Sem 2 (1st Year) ──
  { branch: 'IT', reg: 'R24', sem: 1, code: 'LAC', name: 'Linear Algebra and Calculus' },
  { branch: 'IT', reg: 'R24', sem: 1, code: 'EC', name: 'Engineering Chemistry' },
  { branch: 'IT', reg: 'R24', sem: 1, code: 'PIC', name: 'Programming in C' },
  { branch: 'IT', reg: 'R24', sem: 1, code: 'BEEE', name: 'Basic Electrical and Electronics Engineering' },
  { branch: 'IT', reg: 'R24', sem: 2, code: 'ODENT', name: 'Ordinary Differential Equations and Numerical Techniques' },
  { branch: 'IT', reg: 'R24', sem: 2, code: 'EP', name: 'Engineering Physics' },
  { branch: 'IT', reg: 'R24', sem: 2, code: 'DS', name: 'Data Structures' },
  { branch: 'IT', reg: 'R24', sem: 2, code: 'EELS', name: 'English for Enhancing Leadership Skills' },

  // ── IT R24 Sem 3 & Sem 4 (2nd Year) ──
  { branch: 'IT', reg: 'R24', sem: 3, code: 'CO', name: 'Computer Organization' },
  { branch: 'IT', reg: 'R24', sem: 3, code: 'DM', name: 'Discrete Mathematics' },
  { branch: 'IT', reg: 'R24', sem: 3, code: 'COSM', name: 'Computer Oriented Statistical Methods' },
  { branch: 'IT', reg: 'R24', sem: 3, code: 'DSA', name: 'Data Structures and Algorithms' },
  { branch: 'IT', reg: 'R24', sem: 3, code: 'JAVA', name: 'Object Oriented Programming through Java' },
  { branch: 'IT', reg: 'R24', sem: 4, code: 'OS', name: 'Operating Systems' },
  { branch: 'IT', reg: 'R24', sem: 4, code: 'DAA', name: 'Design and Analysis of Algorithms' },
  { branch: 'IT', reg: 'R24', sem: 4, code: 'SE', name: 'Software Engineering' },
  { branch: 'IT', reg: 'R24', sem: 4, code: 'DBMS', name: 'Database Systems' },
  { branch: 'IT', reg: 'R24', sem: 4, code: 'AJP', name: 'Advanced Java Programming' },

  // ── IT R24 Sem 5 (3rd Year) ──
  { branch: 'IT', reg: 'R24', sem: 5, code: 'DCN', name: 'Data Communications and Networking' },
  { branch: 'IT', reg: 'R24', sem: 5, code: 'IPP', name: 'Introduction to Python Programming' },
  { branch: 'IT', reg: 'R24', sem: 5, code: 'FLAT', name: 'Formal Languages and Automata Theory' },

  // ── IT R22 Sem 5 & Sem 6 (3rd Year) ──
  { branch: 'IT', reg: 'R22', sem: 5, code: 'CN', name: 'Computer Networks' },
  { branch: 'IT', reg: 'R22', sem: 5, code: 'OS', name: 'Operating Systems' },
  { branch: 'IT', reg: 'R22', sem: 5, code: 'DAA', name: 'Design and Analysis of Algorithms' },
  { branch: 'IT', reg: 'R22', sem: 5, code: 'ML', name: 'Machine Learning' },
  { branch: 'IT', reg: 'R22', sem: 5, code: 'EEES', name: 'Essential English and Employability Skills' },
  { branch: 'IT', reg: 'R22', sem: 6, code: 'AI', name: 'Artificial Intelligence' },
  { branch: 'IT', reg: 'R22', sem: 6, code: 'CAA', name: 'Cloud Application Architectures' },
  { branch: 'IT', reg: 'R22', sem: 6, code: 'DS', name: 'Data Science' },
  { branch: 'IT', reg: 'R22', sem: 6, code: 'ED', name: 'Entrepreneurship Development' },
  { branch: 'IT', reg: 'R22', sem: 6, code: 'MS', name: 'Management Science' },

  // ── IT R22 Sem 7 (4th Year 4-1) ──
  { branch: 'IT', reg: 'R22', sem: 7, code: 'CNS', name: 'Cryptography and Network Security' },
  { branch: 'IT', reg: 'R22', sem: 7, code: 'EEES4', name: 'Essential English and Employability Skills' },
  { branch: 'IT', reg: 'R22', sem: 7, code: 'IBCT', name: 'Introduction to Blockchain Technology' },
  { branch: 'IT', reg: 'R22', sem: 7, code: 'MEFA', name: 'Managerial Economics and Financial Analysis' },
  { branch: 'IT', reg: 'R22', sem: 7, code: 'PM', name: 'Project Management' },

  // ── DS R22 Sem 7 (4-1) ──
  { branch: 'DS', reg: 'R22', sem: 7, code: 'BDA', name: 'Big Data Analytics' },
  { branch: 'DS', reg: 'R22', sem: 7, code: 'DL', name: 'Deep Learning' },
  { branch: 'DS', reg: 'R22', sem: 7, code: 'DSA', name: 'Data Science Algorithms' },
  { branch: 'DS', reg: 'R22', sem: 7, code: 'FCC', name: 'Fundamentals of Cloud Computing' },
  { branch: 'DS', reg: 'R22', sem: 7, code: 'MEFA', name: 'Managerial Economics and Financial Analysis' },
  { branch: 'DS', reg: 'R22', sem: 7, code: 'PM', name: 'Project Management' },
];

function matchFirstYearExamPaper(branch, fnameLower) {
  if (fnameLower.includes('java')) return { branch, reg: 'R24', sem: 3, code: 'JAVA' };
  if (fnameLower.includes('ode&nt') || fnameLower.includes('odent')) return { branch, reg: 'R24', sem: 2, code: 'ODENT' };
  if (fnameLower.includes('la&c') || fnameLower.includes('lac')) return { branch, reg: 'R24', sem: 1, code: 'LAC' };
  if (fnameLower.includes('eels')) return { branch, reg: 'R24', sem: 2, code: 'EELS' };
  if (fnameLower.includes('beee')) return { branch, reg: 'R24', sem: 1, code: 'BEEE' };
  if (fnameLower.includes('prog in c') || fnameLower.includes('programming in c') || fnameLower.includes('c programming')) {
    return { branch, reg: 'R24', sem: 1, code: 'PIC' };
  }
  if (fnameLower.includes('ec') || fnameLower.includes('chemistry')) return { branch, reg: 'R24', sem: 1, code: 'EC' };
  if (fnameLower.includes('ep') || fnameLower.includes('physics')) return { branch, reg: 'R24', sem: 2, code: 'EP' };
  if (fnameLower.includes('ds') || fnameLower.includes('data structures')) return { branch, reg: 'R24', sem: 2, code: 'DS' };
  if (fnameLower.includes('mid term papers')) {
    return [
      { branch, reg: 'R24', sem: 1, code: 'LAC' },
      { branch, reg: 'R24', sem: 1, code: 'EC' },
      { branch, reg: 'R24', sem: 1, code: 'PIC' },
      { branch, reg: 'R24', sem: 1, code: 'BEEE' },
    ];
  }
  return null;
}

/**
 * Resolve one catalog file to `{ skipAlreadyMigrated, targets: [...] }`.
 * Returns `targets: null` if unmapped.
 */
export function mapCatalogFile(file) {
  const dept = (file.departmentCode || '').trim().toUpperCase();
  const p = (file.path || []).map((s) => s.trim());
  const pl = p.map((s) => s.toLowerCase());
  const fn = (file.name || '').trim().toLowerCase();

  // CSE 3rd YEAR R22 and 4th YEAR R22 were already migrated into Supabase.
  if (dept === 'CSE' && (p[0] === '3rd YEAR R22' || p[0] === '4th YEAR R22')) {
    return { skipAlreadyMigrated: true, targets: [] };
  }

  // ── CSE ──
  if (dept === 'CSE') {
    if (p[0] === '1st YEAR') {
      if (pl[1]?.includes('exam papers')) {
        if (pl[2] === 'ec') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 1, code: 'EC' }] };
        const m = matchFirstYearExamPaper('CSE', fn);
        return { skipAlreadyMigrated: false, targets: Array.isArray(m) ? m : m ? [m] : null };
      }
      const sub = pl[2] || '';
      if (sub === 'beee') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 1, code: 'BEEE' }] };
      if (sub === 'engineering chemistry') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 1, code: 'EC' }] };
      if (sub === 'la&c') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 1, code: 'LAC' }] };
      if (sub === 'prog in c') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 1, code: 'PIC' }] };
      if (sub === 'data structures') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 2, code: 'DS' }] };
      if (sub === 'engineering physics') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 2, code: 'EP' }] };
      if (sub === 'ode&nt') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 2, code: 'ODENT' }] };
      if (fn.includes('eels')) return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 2, code: 'EELS' }] };
    }
    if (p[0] === '2nd YEAR') {
      const sub = p[1]?.trim().toUpperCase();
      if (sub === 'ADS') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 3, code: 'ADS' }] };
      if (sub === 'COA') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 3, code: 'COA' }] };
      if (sub === 'DM') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 3, code: 'DM' }] };
      if (sub === 'JAVA') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 3, code: 'JAVA' }] };
      if (sub === 'PYTHON') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 3, code: 'PYTHON' }] };
      if (sub === 'QUESTION PAPERS II-I') {
        return {
          skipAlreadyMigrated: false,
          targets: [
            { branch: 'CSE', reg: 'R24', sem: 3, code: 'ADS' },
            { branch: 'CSE', reg: 'R24', sem: 3, code: 'COA' },
            { branch: 'CSE', reg: 'R24', sem: 3, code: 'DM' },
            { branch: 'CSE', reg: 'R24', sem: 3, code: 'JAVA' },
            { branch: 'CSE', reg: 'R24', sem: 3, code: 'PYTHON' },
          ],
        };
      }
      if (sub === 'COSM') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 4, code: 'COSM' }] };
      if (sub === 'DBMS') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 4, code: 'DBMS' }] };
      if (sub === 'FCA') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 4, code: 'FCA' }] };
      if (sub === 'SE') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 4, code: 'SE' }] };
      if (sub === 'WT') return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 4, code: 'WT' }] };
    }
    if (p[0] === '3rd YEAR R24') {
      const sub = p[1]?.trim().toUpperCase();
      if (['ACA', 'AIML', 'OS'].includes(sub)) {
        return { skipAlreadyMigrated: false, targets: [{ branch: 'CSE', reg: 'R24', sem: 5, code: sub }] };
      }
    }
  }

  // ── AIML ──
  if (dept === 'AIML') {
    if (p[0] === '1ST YEAR') {
      const m = matchFirstYearExamPaper('AIML', fn);
      return { skipAlreadyMigrated: false, targets: Array.isArray(m) ? m : m ? [m] : null };
    }
    if (p[0] === '2ND YEAR') {
      if (p.length === 1) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R24', sem: 3, code: 'AI' }] };
      const sub = p[1]?.trim().toUpperCase();
      const sem3 = ['ADS', 'PP', 'AI', 'COA', 'COSM'];
      const sem4 = ['EML', 'JAVA', 'DBMS', 'DAA', 'DM'];
      if (sem3.includes(sub)) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R24', sem: 3, code: sub }] };
      if (sem4.includes(sub)) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R24', sem: 4, code: sub }] };
    }
    if (p[0] === '3RD YEAR') {
      if (p.length === 1) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 5, code: 'EML' }] };
      const sub = p[1]?.trim().toUpperCase();
      const sem5 = ['EML', 'CS', 'WPM', 'ED', 'QAR'];
      const sem6 = ['ATA', 'WDM', 'CVIP', 'CRYPTO', 'IRS', 'TBCS'];
      if (sub === 'R') {
        if (fn.includes('lrqa')) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 5, code: 'QAR' }] };
        return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 6, code: 'RP' }] };
      }
      if (sem5.includes(sub)) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 5, code: sub }] };
      if (sem6.includes(sub)) return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 6, code: sub }] };
    }
    if (p[0] === '4TH YEAR') {
      const sub = p[1]?.trim().toUpperCase();
      if (sub === 'CS') return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 7, code: 'CYBER' }] };
      if (['BD', 'CC', 'DL', 'NLP', 'NS'].includes(sub)) {
        return { skipAlreadyMigrated: false, targets: [{ branch: 'AIML', reg: 'R22', sem: 7, code: sub }] };
      }
    }
  }

  // ── IT ──
  if (dept === 'IT') {
    if (p[0] === 'R24') {
      if (p[1] === 'R24 1st YEAR') {
        const m = matchFirstYearExamPaper('IT', fn);
        return { skipAlreadyMigrated: false, targets: Array.isArray(m) ? m : m ? [m] : null };
      }
      if (p[1] === 'R24 2nd YEAR') {
        if (pl[2] === 'syllabus') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'CO' }] };
        if (pl[2] === 'imp questions') {
          if (pl[3]?.includes('statistical')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'COSM' }] };
          if (pl[3]?.includes('discrete')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'DM' }] };
        }
        const leaf = pl[4] || '';
        if (pl[2] === 'notes' || pl[2] === 'pyq') {
          if (leaf.includes('(co)')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'CO' }] };
          if (leaf.includes('(cosm)')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'COSM' }] };
          if (leaf.includes('(dsa)')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'DSA' }] };
          if (leaf.includes('(dm)')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'DM' }] };
          if (leaf === 'java') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 3, code: 'JAVA' }] };
          if (leaf.includes('advanced java')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 4, code: 'AJP' }] };
          if (leaf.includes('data base')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 4, code: 'DBMS' }] };
          if (leaf.includes('design and analysis')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 4, code: 'DAA' }] };
          if (leaf.includes('operating')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 4, code: 'OS' }] };
          if (leaf.includes('software engineering')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 4, code: 'SE' }] };
        }
      }
      if (p[1] === 'R24 3rd YEAR') {
        if (pl[3] === 'syllabus') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 5, code: 'DCN' }] };
        const s = pl[4] || '';
        if (s === 'dcn') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 5, code: 'DCN' }] };
        if (s === 'flat') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 5, code: 'FLAT' }] };
        if (s === 'ipp') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R24', sem: 5, code: 'IPP' }] };
      }
    }
    if (p[0] === 'R22') {
      if (p[1] === 'R22 3rd YEAR') {
        if (pl[2] === 'lab manual' && pl[3] === 'cc') {
          return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 6, code: 'CAA' }] };
        }
        if (pl[2] === 'syllabus') {
          if (fn.includes('daa')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'DAA' }] };
          return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'CN' }] };
        }
        const s = (pl[2] === 'notes' ? pl[3] : pl[4]) || '';
        if (s.includes('computer networks')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'CN' }] };
        if (s.includes('operating system')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'OS' }] };
        if (s.includes('design') && s.includes('algorithm')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'DAA' }] };
        if (s.includes('machine learning')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'ML' }] };
        if (s.includes('essential english')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 5, code: 'EEES' }] };
        if (s.includes('artificial intelligence')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 6, code: 'AI' }] };
        if (s.includes('cloud')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 6, code: 'CAA' }] };
        if (s.includes('data science')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 6, code: 'DS' }] };
        if (s.includes('entrepreneurship')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 6, code: 'ED' }] };
        if (s.includes('management science')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 6, code: 'MS' }] };
      }
      if (p[1] === 'R22 4th YEAR') {
        if (pl[3] === 'syllabus') {
          if (fn.includes('blockchain') || fn.includes('ibct')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'IBCT' }] };
          if (fn.includes('cns')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'CNS' }] };
          if (fn.includes('mefa')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'MEFA' }] };
          if (fn.includes('eees')) return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'EEES4' }] };
          return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'PM' }] };
        }
        const s = (pl[4] || '');
        if (s === 'cns') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'CNS' }] };
        if (s === 'eees') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'EEES4' }] };
        if (s === 'ibct') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'IBCT' }] };
        if (s === 'mefa') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'MEFA' }] };
        if (s === 'pm') return { skipAlreadyMigrated: false, targets: [{ branch: 'IT', reg: 'R22', sem: 7, code: 'PM' }] };
      }
    }
  }

  // ── DS ──
  if (dept === 'DS') {
    const s = pl[1] || '';
    if (s.includes('bda')) return { skipAlreadyMigrated: false, targets: [{ branch: 'DS', reg: 'R22', sem: 7, code: 'BDA' }] };
    if (s.includes('dl')) return { skipAlreadyMigrated: false, targets: [{ branch: 'DS', reg: 'R22', sem: 7, code: 'DL' }] };
    if (s.includes('dsa')) return { skipAlreadyMigrated: false, targets: [{ branch: 'DS', reg: 'R22', sem: 7, code: 'DSA' }] };
    if (s.includes('fcc')) return { skipAlreadyMigrated: false, targets: [{ branch: 'DS', reg: 'R22', sem: 7, code: 'FCC' }] };
    if (s.includes('mefa')) return { skipAlreadyMigrated: false, targets: [{ branch: 'DS', reg: 'R22', sem: 7, code: 'MEFA' }] };
    if (s.includes('pm')) return { skipAlreadyMigrated: false, targets: [{ branch: 'DS', reg: 'R22', sem: 7, code: 'PM' }] };
  }

  return { skipAlreadyMigrated: false, targets: null };
}

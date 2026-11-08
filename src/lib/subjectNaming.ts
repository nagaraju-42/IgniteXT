/**
 * Subject Acronym & Sequential Material Naming Utility
 * 
 * Rules:
 * - Automatically derives the subject's short_name acronym:
 *   - "Cryptography and Information Security" -> "CIS"
 *   - "Data Science and Visualisation" -> "DSV"
 *   - "Fundamentals of Blockchain Technology" -> "FBT"
 *   - "Fundamentals of Cloud Computing" -> "FCC"
 *   - Keeps "Lab" if present: e.g. "DSV Lab"
 * - Naming:
 *   - Unit Notes: `${shortCode} Unit-${unitNumber}-${nextSeq}`
 *   - PYQ: `${shortCode} PYQ-${nextSeq}`
 *   - Important Questions: `${shortCode} IMP-${nextSeq}`
 */

export function deriveSubjectShortCode(subjectName: string, existingShortName?: string): string {
  if (existingShortName && existingShortName.trim()) {
    return existingShortName.trim().toUpperCase();
  }

  if (!subjectName || !subjectName.trim()) return 'SUB';

  const trimmed = subjectName.trim();
  const lower = trimmed.toLowerCase();

  // Common known JNTU/Engineering acronyms lookup
  const knownMap: Record<string, string> = {
    'cryptography and information security': 'CIS',
    'data science and visualisation': 'DSV',
    'data science and visualization': 'DSV',
    'fundamentals of blockchain technology': 'FBT',
    'fundamentals of cloud computing': 'FCC',
    'database management systems': 'DBMS',
    'compiler design': 'CD',
    'operating systems': 'OS',
    'computer networks': 'CN',
    'machine learning': 'ML',
    'artificial intelligence': 'AI',
    'internet of things': 'IOT',
    'big data': 'BDA',
    'big data analytics': 'BDA',
    'design and analysis of algorithms': 'DAA',
    'formal languages and automata theory': 'FLAT',
    'software engineering': 'SE',
    'discrete mathematics': 'DM',
    'digital logic design': 'DLD',
    'object oriented programming through java': 'OOPJ',
    'r programming': 'RP',
    'python programming': 'PP',
    'project management': 'PM',
    'managerial economics and financial analysis': 'MEFA'
  };

  const isLab = /\blab\b/i.test(trimmed);
  const withoutLab = trimmed.replace(/\blab\b/gi, '').trim().toLowerCase();

  if (knownMap[withoutLab]) {
    return isLab ? `${knownMap[withoutLab]} Lab` : knownMap[withoutLab];
  }
  if (knownMap[lower]) {
    return knownMap[lower];
  }

  // Stop words to ignore when generating acronyms:
  // "and", "of", "in", "to", "for", "the", "&", "through"
  // Note: "Fundamentals" gives 'F' (e.g. FBT, FCC)
  const stopWords = new Set(['and', 'of', 'in', 'to', 'for', 'the', '&', 'through', 'using', 'with']);

  const words = trimmed
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()));

  const acronymLetters: string[] = [];
  words.forEach(w => {
    if (w.toLowerCase() === 'lab') {
      // Retain "Lab" at the end
    } else {
      acronymLetters.push(w[0].toUpperCase());
    }
  });

  let acronym = acronymLetters.join('');
  if (!acronym) acronym = trimmed.substring(0, 3).toUpperCase();

  if (isLab) {
    return `${acronym} Lab`;
  }
  return acronym;
}

/**
 * Generates automated sequential title for a file
 */
export function generateMaterialTitle(params: {
  shortCode: string;
  category: 'notes' | 'pyq' | 'imp';
  unitNumber?: number | string | null;
  seqNumber: number;
}): string {
  const { shortCode, category, unitNumber, seqNumber } = params;
  const cleanCode = (shortCode || 'SUB').toUpperCase().trim();

  if (category === 'notes') {
    const unit = typeof unitNumber === 'number' 
      ? unitNumber 
      : parseInt(String(unitNumber || '1').replace(/\D/g, '')) || 1;
    return `${cleanCode} Unit-${unit}-${seqNumber}`;
  }

  if (category === 'pyq') {
    return `${cleanCode} PYQ-${seqNumber}`;
  }

  if (category === 'imp') {
    return `${cleanCode} IMP-${seqNumber}`;
  }

  return `${cleanCode} Material-${seqNumber}`;
}

/**
 * Formats clean Cloudflare R2 Object Key:
 * ${branch}/${regulation}/${semester}/${shortCode}/${autoTitle.replace(/\s+/g, '_')}.pdf
 */
export function generateR2ObjectKey(params: {
  branch?: string;
  regulation?: string;
  semester?: number | string;
  shortCode: string;
  autoTitle: string;
}): string {
  const branch = (params.branch || 'CSE').toUpperCase().trim();
  const regulation = (params.regulation || 'R22').toUpperCase().trim();
  const semester = params.semester ? `Sem${params.semester}` : 'Sem1';
  const shortCode = (params.shortCode || 'SUB').toUpperCase().replace(/\s+/g, '_').trim();
  const cleanTitle = params.autoTitle.replace(/[^\w\-]/g, '_').replace(/_+/g, '_');

  return `${branch}/${regulation}/${semester}/${shortCode}/${cleanTitle}.pdf`;
}

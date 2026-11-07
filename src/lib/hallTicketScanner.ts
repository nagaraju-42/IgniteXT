export interface TimetableEntry {
  subject_code: string;
  subject_name?: string;
  exam_date: string; // YYYY-MM-DD
  exam_time?: string; // e.g. "10:00 AM - 01:00 PM"
}

export interface HallTicketScanResult {
  roll?: string;
  regulation?: string;
  branch?: string;
  semester?: number;
  timetable: TimetableEntry[];
  usedGemini: boolean;
  rawText?: string;
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

/**
 * Resizes an image to optimal dimensions (< 1200px) and converts to base64 jpeg
 */
async function prepareImageBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64Data = dataUrl.split(',')[1];
        resolve({ base64: base64Data, mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Parses raw OCR text using Regex
 */
export function parseHallTicketRegex(text: string): Partial<HallTicketScanResult> {
  const clean = text.toUpperCase();
  
  // 1. Roll Number (standard Indian Autonomous/JNTUH 10-char roll numbers e.g. 23EG105T42, 21X41A0501)
  const rollMatch = clean.match(/\b([0-9]{2}[A-Z0-9]{2}[15][A-Z0-9]{5})\b/i);
  const roll = rollMatch ? rollMatch[1].toUpperCase() : undefined;

  // 2. Regulation (R18, R20, R22, R24, etc.)
  const regMatch = clean.match(/\b(R18|R20|R22|R23|R24)\b/i);
  const regulation = regMatch ? regMatch[1].toUpperCase() : undefined;

  // 3. Branch (CSE, ECE, EEE, MECH, CIVIL, IT, AIML, DS)
  let branch: string | undefined;
  const branchMatch = clean.match(/\b(CSE|ECE|EEE|MECH|CIVIL|IT|AIML|DS|CSD|CSM)\b/i);
  if (branchMatch) {
    branch = branchMatch[1].toUpperCase();
  } else if (roll) {
    // Inferred from roll number branch code
    if (roll.includes('05') || roll.includes('5T') || roll.includes('A05')) branch = 'CSE';
    else if (roll.includes('04') || roll.includes('A04')) branch = 'ECE';
    else if (roll.includes('02') || roll.includes('A02')) branch = 'EEE';
    else if (roll.includes('03') || roll.includes('A03')) branch = 'MECH';
    else if (roll.includes('01') || roll.includes('A01')) branch = 'CIVIL';
    else if (roll.includes('12')) branch = 'IT';
  }

  // 4. Semester (1-8 or I-VIII)
  let semester: number | undefined;
  const semMatch = clean.match(/(?:SEM|SEMESTER|YEAR\s*[-/]\s*SEM)\s*[-:]?\s*([1-8]|I{1,3}|IV|V|VI{0,3}|VII|VIII)\b/i);
  if (semMatch) {
    const s = semMatch[1].toUpperCase();
    const romanMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
    semester = romanMap[s] || parseInt(s, 10) || undefined;
  }

  // 5. Subject Codes (e.g. A57055, A57065, A57060, CS301, CS402)
  const codeMatches = clean.match(/\b([A-Z][0-9]{5}|CS[0-9]{3}|A[0-9]{5})\b/gi) || [];
  const uniqueCodes = Array.from(new Set(codeMatches.map(c => c.toUpperCase())));

  // 6. Dates in format DD-MM-YYYY or DD/MM/YYYY
  const dateMatches = clean.match(/\b(\d{1,2}[-/.](?:\d{1,2}|[A-Z]{3})[-/.]\d{2,4})\b/gi) || [];

  const timetable: TimetableEntry[] = uniqueCodes.map((code, index) => {
    let dateStr = dateMatches[index] || '';
    return {
      subject_code: code,
      exam_date: normalizeDate(dateStr) || '',
      exam_time: '10:00 AM - 01:00 PM'
    };
  });

  return {
    roll,
    regulation,
    branch,
    semester,
    timetable,
    rawText: text
  };
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  const parts = raw.split(/[-/.]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1];
    let year = parts[2];
    if (year.length === 2) year = `20${year}`;

    // Month word mapping
    const monthMap: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };
    if (monthMap[month.toUpperCase()]) {
      month = monthMap[month.toUpperCase()];
    } else {
      month = month.padStart(2, '0');
    }
    return `${year}-${month}-${day}`;
  }
  return raw;
}

/**
 * On-Device ML Kit OCR (Shape Detection API TextDetector where supported)
 */
async function tryOnDeviceOCR(file: File): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && 'TextDetector' in window) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res) => { img.onload = res; });
      const detector = new (window as any).TextDetector();
      const detected = await detector.detect(img);
      return detected.map((d: any) => d.rawValue).join('\n');
    }
  } catch (err) {
    console.warn('On-device TextDetector error:', err);
  }
  return null;
}

/**
 * Gemini Flash AI Studio API Backup
 */
async function scanWithGeminiAPI(base64: string, mimeType: string): Promise<HallTicketScanResult> {
  const prompt = `
You are a college hall ticket / examination timetable parser for Indian universities and autonomous engineering colleges (JNTUH, OU, etc.).
Carefully analyze this hall ticket image and extract the following:
1. "roll": Student roll number / hall ticket number (e.g. 23EG105T42, 21X41A0501).
2. "regulation": Regulation code (e.g. R22, R20, R24, R18).
3. "branch": Branch abbreviation (e.g. CSE, ECE, EEE, MECH, CIVIL, IT, AIML, DS).
4. "semester": Semester number (1 to 8).
5. "timetable": An array of each examination with:
   - "subject_code": Subject code (e.g. A57055, A57065, A57060, CS301).
   - "subject_name": Full subject title (e.g. "Cryptography and Information Security", "Fundamentals of Blockchain Technology").
   - "exam_date": Examination date in ISO format YYYY-MM-DD. If year is missing, assume current year 2026.
   - "exam_time": Timing (e.g. "10:00 AM - 01:00 PM").

Return ONLY a valid JSON object matching this schema without markdown or commentary:
{
  "roll": "string",
  "regulation": "string",
  "branch": "string",
  "semester": 7,
  "timetable": [
    {
      "subject_code": "A57055",
      "subject_name": "Cryptography and Information Security",
      "exam_date": "2026-11-10",
      "exam_time": "10:00 AM - 01:00 PM"
    }
  ]
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    // If 2.5 flash is busy or fails, try gemini-1.5-flash
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const fallbackRes = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64 } }
            ]
          }
        ]
      })
    });
    if (!fallbackRes.ok) {
      throw new Error(`Gemini API request failed: ${response.statusText}`);
    }
    const fbData = await fallbackRes.json();
    const raw = fbData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
    return {
      roll: parsed.roll,
      regulation: parsed.regulation,
      branch: parsed.branch,
      semester: parsed.semester,
      timetable: parsed.timetable || [],
      usedGemini: true,
      rawText: raw
    };
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    roll: parsed.roll,
    regulation: parsed.regulation,
    branch: parsed.branch,
    semester: parsed.semester,
    timetable: parsed.timetable || [],
    usedGemini: true,
    rawText: rawText
  };
}

/**
 * Master scanner function:
 * 1. Checks on-device OCR / Regex first (0 quota, instant).
 * 2. If blurry or regex fails to find subject codes, calls Gemini Flash backup.
 */
export async function scanHallTicket(file: File): Promise<HallTicketScanResult> {
  const { base64, mimeType } = await prepareImageBase64(file);

  // 1. Try On-Device OCR
  const localText = await tryOnDeviceOCR(file);
  if (localText && localText.trim().length > 20) {
    const regexResult = parseHallTicketRegex(localText);
    // If regex found both roll number and subject codes, we're golden!
    if (regexResult.roll && regexResult.timetable && regexResult.timetable.length >= 2) {
      return {
        roll: regexResult.roll,
        regulation: regexResult.regulation,
        branch: regexResult.branch,
        semester: regexResult.semester,
        timetable: regexResult.timetable,
        usedGemini: false,
        rawText: localText
      };
    }
  }

  // 2. High-accuracy Gemini Flash AI Backup
  try {
    return await scanWithGeminiAPI(base64, mimeType);
  } catch (err) {
    console.error('Gemini Hall Ticket scan error:', err);
    // Return whatever local regex could find as fallback
    if (localText) {
      const fallback = parseHallTicketRegex(localText);
      return {
        roll: fallback.roll,
        regulation: fallback.regulation,
        branch: fallback.branch,
        semester: fallback.semester,
        timetable: fallback.timetable || [],
        usedGemini: false,
        rawText: localText
      };
    }
    throw err;
  }
}

/**
 * Saves detected exam timetable to localStorage
 */
export function saveExamTimetable(timetable: TimetableEntry[]) {
  if (!timetable || timetable.length === 0) return;
  try {
    const current = getExamTimetable();
    const updated = { ...current };
    timetable.forEach(entry => {
      if (entry.subject_code) {
        updated[entry.subject_code.toUpperCase()] = entry;
      }
      if (entry.subject_name) {
        updated[entry.subject_name.trim().toLowerCase()] = entry;
      }
    });
    localStorage.setItem('semkit_exam_timetable', JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('semkit_timetable_updated', { detail: updated }));
    }
  } catch (e) {
    console.error('Failed to save exam timetable:', e);
  }
}

/**
 * Retrieves the stored exam timetable
 */
export function getExamTimetable(): Record<string, TimetableEntry> {
  try {
    const raw = localStorage.getItem('semkit_exam_timetable');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

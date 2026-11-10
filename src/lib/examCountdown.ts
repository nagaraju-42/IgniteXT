/**
 * Shared Exam Timetable loading & live countdown helpers for Website views.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Subject } from './types';
import { DEFAULT_EXAM_TIMETABLE } from './defaultExamTimetable';

export interface SubjectExamStatus {
  status: 'today' | 'tomorrow' | 'upcoming' | 'completed';
  text: string;
  diffDays: number;
  type?: string;
  dateStr?: string;
}

/** Computes nearest upcoming or finished exam status for a subject. */
export function getSubjectExamStatus(sub: Subject, examTimetable: any): SubjectExamStatus | null {
  const codeKey = (sub.code || '').toUpperCase().trim();
  const nameKey = (sub.name || '').toLowerCase().trim();
  const flat = examTimetable?.flatLookup || {};
  const cfg = flat[codeKey] || flat[nameKey] || flat[sub.id] || null;

  if (!cfg) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = [
    { type: 'Mid-1', dateStr: cfg.mid1_date },
    { type: 'Mid-2', dateStr: cfg.mid2_date },
    { type: 'Final', dateStr: cfg.sem_exam_date },
  ].filter((d) => d.dateStr);

  let nearest: { type: string; dateStr: string; diffDays: number } | null = null;

  for (const d of dates) {
    const examDate = new Date(`${d.dateStr}T00:00:00`);
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      if (!nearest || diffDays < nearest.diffDays) {
        nearest = { type: d.type, dateStr: d.dateStr, diffDays };
      }
    }
  }

  if (!nearest) {
    if (dates.length > 0) {
      return { status: 'completed', text: 'Exam Finished', diffDays: -1 };
    }
    return null;
  }

  if (nearest.diffDays === 0) {
    return { status: 'today', text: `🔥 ${nearest.type} Today!`, diffDays: 0, type: nearest.type, dateStr: nearest.dateStr };
  }
  if (nearest.diffDays === 1) {
    return { status: 'tomorrow', text: `⏳ ${nearest.type} Tomorrow`, diffDays: 1, type: nearest.type, dateStr: nearest.dateStr };
  }
  return {
    status: 'upcoming',
    text: `⏳ ${nearest.type} in ${nearest.diffDays} Days`,
    diffDays: nearest.diffDays,
    type: nearest.type,
    dateStr: nearest.dateStr,
  };
}

/** Loads cached exam timetable immediately and syncs fresh timetable from Supabase. */
export async function fetchSyncedExamTimetable(supabase: SupabaseClient): Promise<any> {
  let timetable = DEFAULT_EXAM_TIMETABLE;
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('semkit_exam_timetable_v2');
      if (local) {
        timetable = JSON.parse(local);
      } else {
        localStorage.setItem('semkit_exam_timetable_v2', JSON.stringify(DEFAULT_EXAM_TIMETABLE));
      }
    } catch {
      // Fallback safely to bundled timetable
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'exam_timetable_v2')
        .maybeSingle();

      if (data?.value) {
        const parsed = JSON.parse(data.value);
        if (parsed && (parsed.flatLookup || Object.keys(parsed).length > 0)) {
          timetable = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('semkit_exam_timetable_v2', JSON.stringify(parsed));
          }
        }
      }
    } catch {
      // Non-fatal network error; retain default/cached timetable
    }
  }

  return timetable;
}

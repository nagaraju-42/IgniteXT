'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  SearchIcon,
  GridIcon,
  BookIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Loader2Icon,
  AlertCircleIcon,
  SparklesIcon,
  XIcon,
  ClockIcon,
  CheckCircle2Icon,
  FlameIcon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, StudentProfile } from '@/components/OnboardingModal';
import type { Subject } from '@/lib/types';

interface LastReadState {
  file: string;
  title: string;
  page: number;
  total: number;
  timestamp: number;
}

export default function Home() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lastRead, setLastRead] = useState<LastReadState | null>(null);
  const [examTimetable, setExamTimetable] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);

  const supabase = createClient();

  const loadProfile = () => {
    try {
      const saved = localStorage.getItem('semkit_user_profile') || 
                    localStorage.getItem('semkit_profile') || 
                    localStorage.getItem('ignitext_user_profile') || 
                    localStorage.getItem('ignitext_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        setProfile(parsed);
        return parsed;
      }
      const match = document.cookie.match(/(?:^|; )(?:semkit_profile|ignitext_profile)=([^;]*)/);
      if (match && match[1]) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        setProfile(parsed);
        return parsed;
      }
    } catch (e) {}
    return null;
  };

  const loadLastRead = () => {
    try {
      const data = localStorage.getItem('semkit_last_read');
      if (data) {
        setLastRead(JSON.parse(data));
      } else {
        setLastRead(null);
      }
    } catch (e) {}
  };

  const loadExamTimetable = async () => {
    try {
      const local = localStorage.getItem('semkit_exam_timetable_v2');
      if (local) setExamTimetable(JSON.parse(local));
    } catch(e) {}

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'exam_timetable_v2')
          .maybeSingle();

        if (data && data.value) {
          const parsed = JSON.parse(data.value);
          setExamTimetable(parsed);
          localStorage.setItem('semkit_exam_timetable_v2', JSON.stringify(parsed));
        }
      } catch(err) {}
    }
  };

  const fetchSubjectsForSpace = async (regId: string, branchId: string, sem: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('regulation_id', regId)
        .eq('branch_id', branchId)
        .eq('semester', sem)
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setSubjects(data);
      } else {
        setSubjects([]);
      }
    } catch (err) {
      console.log('Error loading subjects:', err);
      setSubjects([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const setOnline = () => setIsOffline(false);
    const setOff = () => setIsOffline(true);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOff);

    loadLastRead();
    loadExamTimetable();

    const currentProfile = loadProfile();

    if (!currentProfile) {
      setIsModalOpen(true);
      setLoading(false);
    } else {
      fetchSubjectsForSpace(currentProfile.reg_id, currentProfile.branch_id, currentProfile.sem);
    }

    const handleProfileChange = () => {
      const updated = loadProfile();
      if (updated) {
        fetchSubjectsForSpace(updated.reg_id, updated.branch_id, updated.sem);
      }
    };

    const handleLastReadChange = () => loadLastRead();
    const handleTimetableChange = () => loadExamTimetable();

    window.addEventListener('semkit_profile_changed', handleProfileChange);
    window.addEventListener('ignitext_profile_changed', handleProfileChange);
    window.addEventListener('semkit_last_read_updated', handleLastReadChange);
    window.addEventListener('semkit_timetable_updated', handleTimetableChange);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOff);
      window.removeEventListener('semkit_profile_changed', handleProfileChange);
      window.removeEventListener('ignitext_profile_changed', handleProfileChange);
      window.removeEventListener('semkit_last_read_updated', handleLastReadChange);
      window.removeEventListener('semkit_timetable_updated', handleTimetableChange);
    };
  }, []);

  // Compute live exam countdown for a subject
  const getSubjectExamStatus = (sub: Subject) => {
    const codeKey = (sub.code || '').toUpperCase().trim();
    const nameKey = (sub.name || '').toLowerCase().trim();
    const flat = examTimetable.flatLookup || {};
    const cfg = flat[codeKey] || flat[nameKey] || flat[sub.id] || null;

    if (!cfg) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [
      { type: 'Mid-1', dateStr: cfg.mid1_date },
      { type: 'Mid-2', dateStr: cfg.mid2_date },
      { type: 'Final', dateStr: cfg.sem_exam_date }
    ].filter(d => d.dateStr);

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
      return { status: 'today', text: `🔥 ${nearest.type} Today!`, diffDays: 0, type: nearest.type };
    }
    if (nearest.diffDays === 1) {
      return { status: 'tomorrow', text: `⏳ ${nearest.type} Tomorrow`, diffDays: 1, type: nearest.type };
    }
    return { status: 'upcoming', text: `⏳ ${nearest.type} in ${nearest.diffDays} Days`, diffDays: nearest.diffDays, type: nearest.type };
  };

  // Automatically sort subjects so the nearest upcoming exam is #1 at the top
  const { activeSubjects, completedSubjects } = useMemo(() => {
    const active: Subject[] = [];
    const completed: Subject[] = [];

    subjects.forEach(s => {
      const status = getSubjectExamStatus(s);
      if (status?.status === 'completed') {
        completed.push(s);
      } else {
        active.push(s);
      }
    });

    active.sort((a, b) => {
      const examA = getSubjectExamStatus(a);
      const examB = getSubjectExamStatus(b);

      if (examA && !examB) return -1;
      if (!examA && examB) return 1;
      if (!examA && !examB) return a.name.localeCompare(b.name);

      return examA!.diffDays - examB!.diffDays;
    });

    return { activeSubjects: active, completedSubjects: completed };
  }, [subjects, examTimetable]);

  return (
    <div className="px-[18px] pt-4 pb-8">
      {/* Offline Alert */}
      {isOffline && (
        <div className="mb-4 p-3 bg-[#F2F200]/20 border-2 border-[#D7E600] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-[var(--ink)] shrink-0" />
            <span className="text-[12px] font-semibold text-[var(--ink)]">
              You are offline. Downloaded notes are in Saved.
            </span>
          </div>
          <Link
            href="/saved"
            className="text-[11px] font-bold bg-[var(--ink)] text-[var(--paper)] px-3 py-1 rounded-md shrink-0 cursor-pointer"
          >
            Saved
          </Link>
        </div>
      )}

      {/* Header Title Row */}
      <div className="flex justify-between items-start mb-0.5">
        <div>
          <h1 className="font-bold text-[20px] text-[var(--ink)]">Find your notes</h1>
          <p className="text-[11.5px] text-[var(--ink-soft)] mb-3.5">
            Free · no login needed to browse
          </p>
        </div>
        <Link
          href="/support"
          className="text-[10px] font-bold bg-[var(--paper-deep)] text-[var(--ink-soft)] px-3 py-1.5 rounded-full border border-[var(--rule-strong)] hover:bg-[var(--rule)] transition-colors uppercase tracking-wider"
        >
          Feedback
        </Link>
      </div>

      {/* Search Bar */}
      <Link
        href="/search"
        className="flex items-center gap-2 border-[1.5px] border-[var(--ink)] rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--ink-faint)] mb-4 bg-[var(--paper)] hover:border-[var(--ink)] shadow-[2px_2px_0_var(--rule-strong)] transition-all"
      >
        <SearchIcon className="w-4 h-4 text-[var(--ink-soft)]" />
        <span>Search subject, unit or code</span>
      </Link>

      {/* Resume Last Read Page Card */}
      {lastRead && (
        <div className="border-[2px] border-[var(--ink)] bg-[#D7E600]/25 rounded-2xl p-3.5 mb-5 shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <SparklesIcon className="w-3.5 h-3.5 text-[var(--ink)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]">
                Resume Reading
              </span>
            </div>
            <div className="font-bold text-[13.5px] text-[var(--ink)] truncate leading-tight">
              {lastRead.title}
            </div>
            <div className="font-mono text-[10.5px] text-[var(--ink-soft)] mt-0.5 flex items-center gap-1.5">
              <span className="font-bold text-[var(--ink)]">Page {lastRead.page}</span>
              {lastRead.total > 0 && <span>of {lastRead.total}</span>}
            </div>
          </div>
          <button
            onClick={() => {
              window.location.href = `/read?file=${encodeURIComponent(lastRead.file)}&title=${encodeURIComponent(lastRead.title)}&page=${lastRead.page}`;
            }}
            className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[11.5px] px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Resume</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* YOUR SEMESTER SUBJECTS Section (Auto-Sorted with Live Countdown) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookIcon className="w-4 h-4 text-[var(--ink)]" />
            <h2 className="text-[12px] font-bold text-[var(--ink)] uppercase tracking-wider">
              Your Semester Subjects
            </h2>
          </div>
          {profile && (
            <span className="text-[11px] font-mono font-semibold text-[var(--ink-soft)]">
              Sem {profile.sem}
            </span>
          )}
        </div>

        {loading ? (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-xl p-8 bg-[var(--paper)] flex flex-col items-center justify-center gap-2 text-center">
            <Loader2Icon className="w-5 h-5 animate-spin text-[var(--ink)]" />
            <p className="text-[12px] font-medium text-[var(--ink-soft)]">
              Loading semester subjects...
            </p>
          </div>
        ) : profile && activeSubjects.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {activeSubjects.map((sub) => {
              const examStatus = getSubjectExamStatus(sub);

              return (
                <Link
                  key={sub.id}
                  href={`/subject?id=${sub.id}`}
                  className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3.5 bg-[var(--paper)] flex justify-between items-center hover:border-[var(--ink)] hover:shadow-sm transition-all group"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-bold text-[14px] text-[var(--ink)] leading-snug truncate group-hover:underline">
                      {sub.name}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] px-2 py-0.5 rounded text-[var(--ink)] font-semibold text-[10px]">
                        {sub.code || 'SUB'}
                      </span>
                      <span>·</span>
                      <span>{sub.total_units || 5} units</span>

                      {/* Live Exam Countdown Badge */}
                      {examStatus && (
                        <>
                          <span>·</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            examStatus.status === 'today'
                              ? 'bg-red-500 text-white border-red-600 animate-pulse'
                              : examStatus.status === 'tomorrow'
                              ? 'bg-amber-400 text-black border-amber-600'
                              : 'bg-[#D7E600] text-[var(--ink)] border-[var(--ink)]'
                          }`}>
                            {examStatus.text}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[var(--paper-deep)] border border-[var(--rule-strong)] flex items-center justify-center group-hover:bg-[var(--ink)] group-hover:text-[var(--paper)] transition-colors shrink-0">
                    <GridIcon className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : profile && completedSubjects.length === 0 ? (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-xl p-6 bg-[var(--paper)] flex flex-col items-center justify-center text-center gap-2">
            <AlertCircleIcon className="w-6 h-6 text-[var(--ink-soft)]" />
            <p className="text-[13px] font-bold text-[var(--ink)]">
              No subjects found for Semester {profile.sem}
            </p>
            <p className="text-[11.5px] text-[var(--ink-soft)] max-w-[240px]">
              Notes for this semester may not be uploaded yet. You can explore all available subjects in Browse.
            </p>
            <Link
              href="/browse"
              className="mt-2 bg-[var(--ink)] text-[var(--paper)] text-[11.5px] font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Explore All Subjects
            </Link>
          </div>
        ) : null}

        {/* Collapsed Completed Exams Section */}
        {completedSubjects.length > 0 && (
          <div className="mt-4 border border-[var(--rule-strong)] rounded-xl bg-[var(--paper-deep)]/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsCompletedOpen(prev => !prev)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--paper-deep)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="w-4 h-4 text-zinc-500" />
                <span className="font-bold text-[12px] text-[var(--ink-soft)] uppercase tracking-wider">
                  Completed Exams ({completedSubjects.length})
                </span>
              </div>
              <ChevronDownIcon className={`w-4 h-4 text-[var(--ink-soft)] transition-transform duration-200 ${isCompletedOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCompletedOpen && (
              <div className="p-3 pt-0 flex flex-col gap-2 border-t border-[var(--rule)]">
                {completedSubjects.map(sub => (
                  <Link
                    key={sub.id}
                    href={`/subject?id=${sub.id}`}
                    className="border border-[var(--rule)] rounded-lg p-3 bg-[var(--paper)] opacity-70 hover:opacity-100 flex justify-between items-center transition-opacity"
                  >
                    <div>
                      <div className="font-semibold text-[13px] text-[var(--ink)]">{sub.name}</div>
                      <div className="font-mono text-[10px] text-zinc-500 mt-0.5">{sub.code || 'SUB'} · Exam Finished</div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Continue Browsing Banner */}
      <Link
        href="/browse"
        className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3.5 bg-[var(--paper)] flex justify-between items-center hover:border-[var(--ink)] hover:bg-[var(--paper-deep)] transition-all group shadow-sm mb-4"
      >
        <div>
          <div className="font-bold text-[13.5px] text-[var(--ink)] group-hover:text-[var(--hl-ink)] transition-colors">
            Continue browsing
          </div>
          <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
            Explore notes from other regulations, branches and semesters
          </div>
        </div>
        <div className="w-8 h-8 rounded-full border border-[var(--rule-strong)] flex items-center justify-center group-hover:border-[var(--ink)] transition-colors">
          <ChevronRightIcon className="w-4 h-4 text-[var(--ink-soft)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>

      {/* Modal */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(newProfile) => {
          setProfile(newProfile);
          setIsModalOpen(false);
          fetchSubjectsForSpace(newProfile.reg_id, newProfile.branch_id, newProfile.sem);
        }}
        initialProfile={profile}
      />
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
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
  BookOpenCheckIcon,
  XIcon,
  CheckCircle2Icon,
  ClockIcon,
  FlameIcon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, StudentProfile } from '@/components/OnboardingModal';
import { getExamTimetable, TimetableEntry } from '@/lib/hallTicketScanner';
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
  const [timetable, setTimetable] = useState<Record<string, TimetableEntry>>({});
  const [lastRead, setLastRead] = useState<LastReadState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  const supabase = createClient();

  const loadProfile = () => {
    try {
      const saved = localStorage.getItem('semkit_profile') || localStorage.getItem('ignitext_profile');
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

  const loadTimetable = async () => {
    // 1. Load instantly from local storage
    const local = getExamTimetable();
    setTimetable(local);

    // 2. Fetch official timetable from Supabase platform_settings
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'exam_timetable')
          .single();
        if (data && data.value) {
          const parsed = JSON.parse(data.value);
          setTimetable(prev => ({ ...parsed, ...prev }));
        }
      } catch (err) {}
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
    loadTimetable();

    const currentProfile = loadProfile();

    if (!currentProfile) {
      // If no profile, prompt setup first
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
    const handleTimetableChange = () => loadTimetable();

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

  // Compute live exam status and countdown for a subject
  const getSubjectExam = (sub: Subject) => {
    const codeKey = (sub.code || '').toUpperCase().trim();
    const nameKey = (sub.name || '').toLowerCase().trim();
    const entry = timetable[codeKey] || timetable[nameKey] || null;

    const examDateStr = entry?.exam_date || (sub as any).exam_date;
    if (!examDateStr) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const examDate = new Date(examDateStr.includes('T') ? examDateStr : `${examDateStr}T00:00:00`);
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'completed', text: 'Exam Finished', diffDays, date: examDateStr };
    }
    if (diffDays === 0) {
      return { status: 'today', text: '🔥 Exam Today!', diffDays, date: examDateStr };
    }
    if (diffDays === 1) {
      return { status: 'tomorrow', text: '⏳ Exam Tomorrow', diffDays, date: examDateStr };
    }
    return { status: 'upcoming', text: `⏳ Exam in ${diffDays} Days`, diffDays, date: examDateStr };
  };

  // Group and sort subjects: upcoming exam is #1 at the top!
  const activeSubjectItems: { sub: Subject; exam: ReturnType<typeof getSubjectExam> }[] = [];
  const completedSubjectItems: { sub: Subject; exam: ReturnType<typeof getSubjectExam> }[] = [];

  subjects.forEach(sub => {
    const exam = getSubjectExam(sub);
    if (exam && exam.status === 'completed') {
      completedSubjectItems.push({ sub, exam });
    } else {
      activeSubjectItems.push({ sub, exam });
    }
  });

  // Sort active subjects so nearest upcoming exam is always #1 at the top
  activeSubjectItems.sort((a, b) => {
    if (a.exam && !b.exam) return -1;
    if (!a.exam && b.exam) return 1;
    if (a.exam && b.exam) {
      return a.exam.diffDays - b.exam.diffDays;
    }
    return a.sub.name.localeCompare(b.sub.name);
  });

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
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink)]">
                Resume Last Read
              </span>
            </div>
            <div className="font-bold text-[13.5px] text-[var(--ink)] leading-snug truncate">
              {lastRead.title}
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-soft)] mt-0.5">
              Page {lastRead.page} of {lastRead.total} · Continue where you left off
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href={`/read?file=${encodeURIComponent(lastRead.file)}&title=${encodeURIComponent(lastRead.title)}&page=${lastRead.page}`}
              className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[11.5px] px-3.5 py-2.5 rounded-xl flex items-center gap-1 active:scale-95 shadow-xs transition-all cursor-pointer"
            >
              <span>Resume</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => {
                localStorage.removeItem('semkit_last_read');
                setLastRead(null);
              }}
              className="w-7 h-7 flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors rounded-lg cursor-pointer"
              title="Dismiss"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* If No Profile Configured: Prompt Card */}
      {!profile && (
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[#D7E600]/15 mb-6 shadow-[3px_3px_0_var(--ink)]">
          <div className="flex items-center gap-2 mb-1.5">
            <SparklesIcon className="w-4 h-4 text-[var(--ink)]" />
            <h2 className="font-bold text-[14.5px] text-[var(--ink)]">Personalize Your Space</h2>
          </div>
          <p className="text-[12px] text-[var(--ink-soft)] mb-3 leading-relaxed">
            Set up your profile once or scan your hall ticket to view your exact subjects and live exam countdowns automatically.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-[#D7E600] text-[var(--ink)] font-bold text-[13px] py-2.5 rounded-xl border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center gap-1.5 hover:translate-y-[1px] transition-all cursor-pointer"
          >
            <span>Set Up My Space</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* YOUR SEMESTER SUBJECTS Section */}
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
        ) : profile && activeSubjectItems.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {activeSubjectItems.map(({ sub, exam }) => (
              <Link
                key={sub.id}
                href={`/subject?id=${sub.id}`}
                className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3.5 bg-[var(--paper)] flex justify-between items-center hover:border-[var(--ink)] hover:shadow-sm transition-all group"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-bold text-[14px] text-[var(--ink)] leading-snug truncate group-hover:underline">
                    {sub.name}
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-1.5 flex items-center flex-wrap gap-2">
                    <span className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] px-2 py-0.5 rounded text-[var(--ink)] font-semibold text-[10px]">
                      {sub.code || 'SUB'}
                    </span>
                    <span>·</span>
                    <span>{sub.total_units || 5} units</span>

                    {/* Live Exam Countdown Badge */}
                    {exam && (
                      <>
                        <span>·</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 ${
                          exam.status === 'today'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : exam.status === 'tomorrow'
                            ? 'bg-[#D7E600] text-[var(--ink)] font-extrabold border border-[var(--ink)]'
                            : 'bg-[#D7E600]/25 text-[var(--ink)] border border-[var(--rule-strong)]'
                        }`}>
                          {exam.text}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[var(--paper-deep)] border border-[var(--rule-strong)] flex items-center justify-center group-hover:bg-[var(--ink)] group-hover:text-[var(--paper)] transition-colors shrink-0">
                  <GridIcon className="w-4 h-4" />
                </div>
              </Link>
            ))}

            {/* Collapsed Completed Exams Section */}
            {completedSubjectItems.length > 0 && (
              <div className="mt-2 border-[1.5px] border-[var(--rule-strong)] rounded-xl overflow-hidden bg-[var(--paper-deep)]">
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--rule)] transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-[12px] text-[var(--ink)]">
                      Completed Exams ({completedSubjectItems.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] text-[var(--ink-soft)]">
                      {showCompleted ? 'Hide' : 'Show'}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-[var(--ink-soft)] transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showCompleted && (
                  <div className="p-3 pt-0 flex flex-col gap-2 border-t border-[var(--rule)] bg-[var(--paper)]">
                    {completedSubjectItems.map(({ sub, exam }) => (
                      <Link
                        key={sub.id}
                        href={`/subject?id=${sub.id}`}
                        className="p-2.5 rounded-lg border border-[var(--rule)] bg-[var(--paper-deep)]/40 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-medium text-[13px] text-[var(--ink)] truncate block">
                            {sub.name}
                          </span>
                          <span className="font-mono text-[10px] text-emerald-700 font-semibold">
                            ✓ {exam?.text || 'Exam Completed'}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[var(--ink-faint)]">
                          {sub.code || 'SUB'}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : profile ? (
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
            Filter by university, regulation, branch & semester
          </div>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-[var(--ink-soft)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 transition-all" />
      </Link>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => {
          if (profile) setIsModalOpen(false);
        }}
        initialProfile={profile}
        onSave={(newProfile) => {
          setProfile(newProfile);
          setIsModalOpen(false);
          fetchSubjectsForSpace(newProfile.reg_id, newProfile.branch_id, newProfile.sem);
        }}
      />
    </div>
  );
}

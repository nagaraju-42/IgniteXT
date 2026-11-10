'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SearchIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Loader2Icon,
  SparklesIcon,
  CheckCircle2Icon,
  SlidersHorizontalIcon,
  FileTextIcon,
  AlertCircleIcon,
  ArrowRightIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, type StudentProfile } from '@/components/OnboardingModal';
import { WebSpaceCard, readStudentSpaceProfile } from '@/components/web/WebSpaceCard';
import type { Subject } from '@/lib/types';
import { DEFAULT_EXAM_TIMETABLE } from '@/lib/defaultExamTimetable';
import { fetchSyncedExamTimetable, getSubjectExamStatus } from '@/lib/examCountdown';
import { deriveSubjectShortCode } from '@/lib/subjectNaming';

interface LastReadState {
  file: string;
  title: string;
  page: number;
  total: number;
  subjectId?: string;
  timestamp: number;
}

const POPULAR_SHORTCUTS = ['CIS', 'FCC', 'WT', 'OS', 'ML', 'CN'];

export function WebHome() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState<boolean>(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, { notes: number; pyqs: number }>>({});
  const [lastRead, setLastRead] = useState<LastReadState | null>(null);
  const [examTimetable, setExamTimetable] = useState<any>(DEFAULT_EXAM_TIMETABLE);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);

  const [heroSearch, setHeroSearch] = useState<string>('');
  const [spaceWarning, setSpaceWarning] = useState<string | null>(null);
  const rollInputRef = useRef<HTMLInputElement | null>(null);

  const loadLastRead = () => {
    try {
      const data = localStorage.getItem('semkit_last_read');
      setLastRead(data ? JSON.parse(data) : null);
    } catch {
      setLastRead(null);
    }
  };

  useEffect(() => {
    loadLastRead();
    fetchSyncedExamTimetable(supabase).then(setExamTimetable);

    const saved = readStudentSpaceProfile();
    setProfile(saved);
    setProfileChecked(true);

    const onProfileChange = () => {
      const updated = readStudentSpaceProfile();
      setProfile(updated);
      setSpaceWarning(null);
    };
    const onLastReadChange = () => loadLastRead();
    const onTimetableChange = () => fetchSyncedExamTimetable(supabase).then(setExamTimetable);

    window.addEventListener('semkit_profile_changed', onProfileChange);
    window.addEventListener('ignitext_profile_changed', onProfileChange);
    window.addEventListener('semkit_last_read_updated', onLastReadChange);
    window.addEventListener('semkit_timetable_updated', onTimetableChange);

    return () => {
      window.removeEventListener('semkit_profile_changed', onProfileChange);
      window.removeEventListener('ignitext_profile_changed', onProfileChange);
      window.removeEventListener('semkit_last_read_updated', onLastReadChange);
      window.removeEventListener('semkit_timetable_updated', onTimetableChange);
    };
  }, []);

  // Load ONLY the user's selected Space subjects once Space IS set
  useEffect(() => {
    if (!profile?.reg_id || !profile?.branch_id || !profile?.sem) {
      setSubjects([]);
      return;
    }
    let cancelled = false;

    async function loadSpaceSubjects() {
      setLoading(true);
      try {
        const { data: subs } = await supabase
          .from('subjects')
          .select('*')
          .eq('regulation_id', profile!.reg_id)
          .eq('branch_id', profile!.branch_id)
          .eq('semester', profile!.sem)
          .eq('is_active', true)
          .order('name');

        if (cancelled) return;
        const list = (subs || []) as Subject[];
        setSubjects(list);

        if (list.length > 0) {
          const ids = list.map((s) => s.id);
          const { data: items } = await supabase
            .from('content_items')
            .select('subject_id, type')
            .in('subject_id', ids)
            .eq('status', 'published');

          if (!cancelled && items) {
            const nextCounts: Record<string, { notes: number; pyqs: number }> = {};
            for (const item of items) {
              if (!nextCounts[item.subject_id]) {
                nextCounts[item.subject_id] = { notes: 0, pyqs: 0 };
              }
              if (item.type === 'pyq') nextCounts[item.subject_id].pyqs += 1;
              else nextCounts[item.subject_id].notes += 1;
            }
            setCountsMap(nextCounts);
          }
        } else {
          setCountsMap({});
        }
      } catch {
        if (!cancelled) setSubjects([]);
      }
      if (!cancelled) setLoading(false);
    }

    loadSpaceSubjects();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const { activeSubjects, completedSubjects } = useMemo(() => {
    const active: Subject[] = [];
    const completed: Subject[] = [];

    subjects.forEach((s) => {
      const status = getSubjectExamStatus(s, examTimetable);
      if (status?.status === 'completed') completed.push(s);
      else active.push(s);
    });

    active.sort((a, b) => {
      const examA = getSubjectExamStatus(a, examTimetable);
      const examB = getSubjectExamStatus(b, examTimetable);
      if (examA && !examB) return -1;
      if (!examA && examB) return 1;
      if (!examA && !examB) return a.name.localeCompare(b.name);
      return examA!.diffDays - examB!.diffDays;
    });

    return { activeSubjects: active, completedSubjects: completed };
  }, [subjects, examTimetable]);

  const nudgeSpaceSetup = () => {
    setSpaceWarning('Please set your Roll Number, Regulation, Branch, and Semester below before searching or browsing notes.');
    const el = document.getElementById('web-set-space');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => rollInputRef.current?.focus(), 250);
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      nudgeSpaceSetup();
      return;
    }
    const q = heroSearch.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const handleShortcutClick = (code: string) => {
    if (!profile) {
      nudgeSpaceSetup();
      return;
    }
    router.push(`/search?q=${encodeURIComponent(code)}`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Hero Card — Clean Single-Focus Banner (Only up to Image 2) */}
      <section className="border-2 border-[var(--ink)] rounded-3xl bg-[var(--paper-card)] p-5 sm:p-8 shadow-[4px_4px_0_var(--ink)] mb-7">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#D7E600] text-[var(--ink)] border-[1.5px] border-[var(--ink)] px-3 py-1 rounded-full font-mono text-[10.5px] font-black uppercase tracking-wider mb-3 shadow-[2px_2px_0_var(--ink)]">
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>Instant Browser Auto-Preview · No Download Needed</span>
          </div>

          <h1 className="font-display font-black text-[34px] sm:text-[46px] leading-[0.95] text-[var(--ink)] mb-2.5 tracking-tight">
            PREPARE SMART FOR EXAMS ONLINE
          </h1>
          <p className="text-[13.5px] sm:text-[15px] text-[var(--ink-soft)] max-w-2xl mb-5 leading-relaxed">
            Open unit-wise PDFs, faculty slides, important topics & previous year question papers directly in your laptop or phone browser.
          </p>

          {/* Hero Search Form */}
          <form onSubmit={handleHeroSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-2xl mb-4">
            <div className="relative flex-1">
              <SearchIcon className="w-4 h-4 text-[var(--ink-soft)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                placeholder="Search subject, acronym or note (e.g. CIS, WT, OS, ML)..."
                className="w-full bg-[var(--paper)] border-2 border-[var(--ink)] rounded-xl pl-10 pr-4 py-2.5 text-[13.5px] font-medium text-[var(--ink)] placeholder:text-[var(--ink-faint)] shadow-[2px_2px_0_var(--ink)] focus:outline-none focus:bg-white transition-all"
              />
            </div>
            <button type="submit" className="btn btn-p justify-center cursor-pointer shrink-0">
              <span>Search Notes</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Shortcut Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-mono font-bold text-[var(--ink-soft)] uppercase mr-1">Popular:</span>
            {POPULAR_SHORTCUTS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleShortcutClick(code)}
                className="font-mono font-bold bg-[var(--paper)] hover:bg-[#D7E600] text-[var(--ink)] border border-[var(--rule-strong)] hover:border-[var(--ink)] px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* BELOW IMAGE 2: Mandatory Set Space Window until Space is Configured, then User's Space Subjects */}
      {!profileChecked ? (
        <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-10 bg-[var(--paper-card)] flex flex-col items-center justify-center gap-2">
          <Loader2Icon className="w-6 h-6 animate-spin text-[var(--ink)]" />
          <p className="text-[12.5px] font-bold text-[var(--ink-soft)]">Checking your space...</p>
        </div>
      ) : !profile ? (
        <WebSpaceCard
          onSave={(newProf) => {
            setProfile(newProf);
            setSpaceWarning(null);
          }}
          attentionMessage={spaceWarning}
          rollInputRef={rollInputRef}
        />
      ) : (
        <>
          {/* Resume Reading Strip (when user has prior reading progress) */}
          {lastRead && (
            <Link
              href={`/read?file=${encodeURIComponent(lastRead.file)}&title=${encodeURIComponent(
                lastRead.title
              )}&page=${lastRead.page || 1}${lastRead.subjectId ? `&subjectId=${lastRead.subjectId}` : ''}`}
              className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[#D7E600]/30 hover:bg-[#D7E600]/45 shadow-[3px_3px_0_var(--ink)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 transition-all"
            >
              <div className="min-w-0">
                <div className="font-mono text-[10.5px] font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5 mb-0.5">
                  <FileTextIcon className="w-3.5 h-3.5" />
                  <span>Resume Reading</span>
                </div>
                <div className="font-bold text-[15px] text-[var(--ink)] truncate">
                  {lastRead.title}
                </div>
                <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5">
                  Page {lastRead.page} {lastRead.total > 0 ? `of ${lastRead.total}` : ''}
                </div>
              </div>
              <span className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[12px] px-4 py-2 rounded-xl shrink-0 text-center">
                Resume →
              </span>
            </Link>
          )}

          {/* Your Personalized Semester Subjects Header */}
          <section className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <BookOpenIcon className="w-5 h-5 text-[var(--ink)]" />
              <h2 className="font-display font-black text-[26px] text-[var(--ink)] tracking-tight leading-none">
                YOUR SEMESTER SUBJECTS
              </h2>
              <span className="font-mono text-[11px] font-bold bg-[#D7E600] border border-[var(--ink)] px-2.5 py-0.5 rounded-full text-[var(--ink)]">
                {profile.branch_code} · {profile.reg_code} · Sem {profile.sem}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-mono text-[11.5px] font-bold px-3 py-2 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper-card)] hover:bg-[#D7E600] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <SlidersHorizontalIcon className="w-3.5 h-3.5" />
                <span>Edit Space</span>
              </button>
              <Link
                href="/browse"
                className="font-mono text-[11.5px] font-bold px-3 py-2 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper)] hover:bg-[#D7E600] transition-colors"
              >
                Browse All →
              </Link>
            </div>
          </section>

          {/* Responsive Subjects Grid */}
          {loading ? (
            <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-12 bg-[var(--paper-card)] flex flex-col items-center justify-center gap-3">
              <Loader2Icon className="w-7 h-7 animate-spin text-[var(--ink)]" />
              <p className="text-[13px] font-bold text-[var(--ink-soft)]">
                Loading {profile.reg_code} Semester {profile.sem} subjects...
              </p>
            </div>
          ) : activeSubjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {activeSubjects.map((sub) => {
                const examStatus = getSubjectExamStatus(sub, examTimetable);
                const shortCode = deriveSubjectShortCode(sub.name, sub.code);
                const counts = countsMap[sub.id] || { notes: 0, pyqs: 0 };

                return (
                  <Link
                    key={sub.id}
                    href={`/subject?id=${sub.id}`}
                    className="border-2 border-[var(--ink)] rounded-2xl p-4 sm:p-5 bg-[#FAF9F5] shadow-[3px_3px_0_var(--ink)] hover:shadow-[5px_5px_0_var(--ink)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                        <span className="font-mono text-[11px] font-black bg-[#D7E600] text-[var(--ink)] px-2.5 py-0.5 rounded-md border border-[var(--ink)]">
                          {shortCode}
                        </span>

                        {examStatus ? (
                          <span
                            className={`font-mono text-[10px] font-black px-2.5 py-0.5 rounded-md border ${
                              examStatus.status === 'today'
                                ? 'bg-red-500 text-white border-red-700 animate-pulse'
                                : examStatus.status === 'tomorrow'
                                ? 'bg-amber-400 text-black border-amber-700'
                                : 'bg-[var(--paper-deep)] text-[var(--ink)] border-[var(--ink)]'
                            }`}
                          >
                            {examStatus.text}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] font-bold text-[var(--ink-soft)]">
                            {sub.total_units || 5} Units
                          </span>
                        )}
                      </div>

                      <h3 className="font-sans font-extrabold text-[16px] text-[var(--ink)] leading-snug group-hover:underline line-clamp-2">
                        {sub.name}
                      </h3>
                    </div>

                    <div className="pt-3 border-t border-[var(--rule-strong)] flex items-center justify-between text-[11.5px]">
                      <div className="font-mono font-semibold text-[var(--ink-soft)] flex items-center gap-2">
                        <span>{counts.notes} Notes</span>
                        <span>·</span>
                        <span>{counts.pyqs} PYQs</span>
                      </div>
                      <span className="font-bold text-[var(--ink)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Preview Notes <ChevronRightIcon className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : completedSubjects.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-10 bg-[var(--paper-card)] text-center mb-8 flex flex-col items-center gap-2">
              <AlertCircleIcon className="w-7 h-7 text-[var(--ink-soft)]" />
              <p className="font-bold text-[15px] text-[var(--ink)]">
                No subjects found for {profile.reg_code} {profile.branch_code} Semester {profile.sem}
              </p>
              <p className="text-[12.5px] text-[var(--ink-soft)] max-w-md mb-2">
                Notes for this semester may not be uploaded yet. You can explore other semesters or regulations in Browse.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="btn btn-s cursor-pointer"
                >
                  Change Semester
                </button>
                <Link href="/browse" className="btn btn-p inline-flex">
                  Explore All Subjects
                </Link>
              </div>
            </div>
          ) : null}

          {/* Completed Exams Collapsible Drawer */}
          {completedSubjects.length > 0 && (
            <section className="border-2 border-[var(--rule-strong)] rounded-2xl bg-[var(--paper-card)] overflow-hidden mb-6">
              <button
                type="button"
                onClick={() => setIsCompletedOpen((prev) => !prev)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[var(--paper-deep)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="w-4 h-4 text-[var(--ink-soft)]" />
                  <span className="font-mono font-bold text-[12px] text-[var(--ink-soft)] uppercase tracking-wider">
                    Completed Exams ({completedSubjects.length})
                  </span>
                </div>
                <ChevronDownIcon
                  className={`w-4 h-4 text-[var(--ink-soft)] transition-transform ${
                    isCompletedOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isCompletedOpen && (
                <div className="p-4 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-[var(--rule)]">
                  {completedSubjects.map((sub) => {
                    const counts = countsMap[sub.id] || { notes: 0, pyqs: 0 };
                    return (
                      <Link
                        key={sub.id}
                        href={`/subject?id=${sub.id}`}
                        className="border border-[var(--rule-strong)] rounded-xl p-3.5 bg-[var(--paper)] hover:border-[var(--ink)] flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[13.5px] text-[var(--ink)] truncate">
                            {sub.name}
                          </div>
                          <div className="font-mono text-[10.5px] text-[var(--ink-soft)] mt-0.5">
                            {deriveSubjectShortCode(sub.name, sub.code)} · {counts.notes} Notes ·{' '}
                            {counts.pyqs} PYQs
                          </div>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-[var(--ink-soft)] shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Continue Browsing Banner */}
          <Link
            href="/browse"
            className="border-2 border-[var(--rule-strong)] hover:border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper-card)] hover:bg-[var(--paper-deep)] flex items-center justify-between gap-3 transition-all"
          >
            <div>
              <div className="font-bold text-[14.5px] text-[var(--ink)]">Continue browsing</div>
              <div className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                Explore notes from other regulations, branches and semesters
              </div>
            </div>
            <div className="w-9 h-9 rounded-full border border-[var(--rule-strong)] flex items-center justify-center shrink-0">
              <ChevronRightIcon className="w-4 h-4 text-[var(--ink)]" />
            </div>
          </Link>
        </>
      )}

      {/* Modal for Editing Space once already set */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(newProf) => {
          setProfile(newProf);
          setIsModalOpen(false);
        }}
        initialProfile={profile}
      />
    </div>
  );
}

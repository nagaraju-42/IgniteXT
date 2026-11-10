'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ClockIcon,
  ArrowRightIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, type StudentProfile } from '@/components/OnboardingModal';
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
  const [regulations, setRegulations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Active web workspace filter (works immediately even for guests without profile!)
  const [activeRegId, setActiveRegId] = useState<string>('');
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [activeSem, setActiveSem] = useState<number>(7);
  const [availableSems, setAvailableSems] = useState<number[]>([5, 6, 7]);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, { notes: number; pyqs: number }>>({});
  const [lastRead, setLastRead] = useState<LastReadState | null>(null);
  const [examTimetable, setExamTimetable] = useState<any>(DEFAULT_EXAM_TIMETABLE);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);
  const [heroSearch, setHeroSearch] = useState<string>('');

  const readSavedProfile = (): StudentProfile | null => {
    try {
      const saved =
        localStorage.getItem('semkit_user_profile') ||
        localStorage.getItem('semkit_profile') ||
        localStorage.getItem('ignitext_user_profile') ||
        localStorage.getItem('ignitext_profile');
      if (saved) return JSON.parse(saved);

      const match = document.cookie.match(/(?:^|; )(?:semkit_profile|ignitext_profile)=([^;]*)/);
      if (match && match[1]) return JSON.parse(decodeURIComponent(match[1]));
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  const loadLastRead = () => {
    try {
      const data = localStorage.getItem('semkit_last_read');
      setLastRead(data ? JSON.parse(data) : null);
    } catch {
      setLastRead(null);
    }
  };

  // Initialize workspace defaults smoothly without blocking first-time web visitors
  useEffect(() => {
    loadLastRead();
    fetchSyncedExamTimetable(supabase).then(setExamTimetable);

    async function bootstrapWorkspace() {
      const savedProf = readSavedProfile();
      setProfile(savedProf);

      const [regRes, brRes] = await Promise.all([
        supabase.from('regulations').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('branches').select('*').eq('is_active', true).order('sort_order'),
      ]);

      const regs = regRes.data || [];
      const brs = brRes.data || [];
      setRegulations(regs);
      setBranches(brs);

      // Prefer saved profile space, or default cleanly to R22 + CSE + Sem 7
      const r22 = regs.find((r: any) => (r.code || '').toUpperCase() === 'R22') || regs[0];
      const cse = brs.find((b: any) => (b.code || '').toUpperCase() === 'CSE') || brs[0];

      const initialRegId = savedProf?.reg_id || r22?.id || '';
      const initialBranchId = savedProf?.branch_id || cse?.id || '';
      const initialSem = savedProf?.sem || 7;

      setActiveRegId(initialRegId);
      setActiveBranchId(initialBranchId);
      setActiveSem(initialSem);

      // Discover which semesters actually have subjects under this regulation+branch
      if (initialRegId && initialBranchId) {
        const { data: semRows } = await supabase
          .from('subjects')
          .select('semester')
          .eq('regulation_id', initialRegId)
          .eq('branch_id', initialBranchId)
          .eq('is_active', true);

        if (semRows && semRows.length > 0) {
          const unique = Array.from(
            new Set<number>(semRows.map((s: { semester: number }) => Number(s.semester)))
          ).sort((a, b) => a - b);
          setAvailableSems(unique);
          if (!unique.includes(initialSem)) {
            setActiveSem(unique[unique.length - 1]);
          }
        }
      }
    }

    bootstrapWorkspace();

    const onProfileChange = () => {
      const updated = readSavedProfile();
      setProfile(updated);
      if (updated) {
        setActiveRegId(updated.reg_id);
        setActiveBranchId(updated.branch_id);
        setActiveSem(updated.sem);
      }
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

  // Load subjects and note/PYQ counts whenever active regulation/branch/semester changes
  useEffect(() => {
    if (!activeRegId || !activeBranchId) return;
    let cancelled = false;

    async function loadSemesterSubjects() {
      setLoading(true);
      try {
        const { data: subs } = await supabase
          .from('subjects')
          .select('*')
          .eq('regulation_id', activeRegId)
          .eq('branch_id', activeBranchId)
          .eq('semester', activeSem)
          .eq('is_active', true)
          .order('name');

        if (cancelled) return;
        const subjectList = (subs || []) as Subject[];
        setSubjects(subjectList);

        if (subjectList.length > 0) {
          const ids = subjectList.map((s) => s.id);
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

    loadSemesterSubjects();
    return () => {
      cancelled = true;
    };
  }, [activeRegId, activeBranchId, activeSem]);

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

  const nextExamSubject = activeSubjects[0] || null;
  const nextExamStatus = nextExamSubject ? getSubjectExamStatus(nextExamSubject, examTimetable) : null;

  const activeRegCode =
    regulations.find((r) => r.id === activeRegId)?.code || profile?.reg_code || 'R22';
  const activeBranchCode =
    branches.find((b) => b.id === activeBranchId)?.code || profile?.branch_code || 'CSE';

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroSearch.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const getSemLabel = (sem: number) => {
    const map: Record<number, string> = {
      1: '1-1',
      2: '1-2',
      3: '2-1',
      4: '2-2',
      5: '3-1',
      6: '3-2',
      7: '4-1',
      8: '4-2',
    };
    return `Sem ${sem} (${map[sem] || sem})`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Exam Prep Hero Section */}
      <section className="border-2 border-[var(--ink)] rounded-3xl bg-[var(--paper-card)] p-5 sm:p-7 shadow-[4px_4px_0_var(--ink)] mb-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-6 items-center">
          {/* Left Hero Column */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#D7E600] text-[var(--ink)] border-[1.5px] border-[var(--ink)] px-3 py-1 rounded-full font-mono text-[10.5px] font-black uppercase tracking-wider mb-3 shadow-[2px_2px_0_var(--ink)]">
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Instant Browser Auto-Preview · No Download Needed</span>
            </div>

            <h1 className="font-display font-black text-[34px] sm:text-[44px] leading-[0.95] text-[var(--ink)] mb-2.5 tracking-tight">
              PREPARE SMART FOR EXAMS ONLINE
            </h1>
            <p className="text-[13.5px] sm:text-[14.5px] text-[var(--ink-soft)] max-w-xl mb-5 leading-relaxed">
              Open unit-wise PDFs, faculty slides, important topics & previous year question papers directly in your laptop or phone browser.
            </p>

            {/* Hero Search Form */}
            <form onSubmit={handleHeroSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-xl mb-3.5">
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
                <Link
                  key={code}
                  href={`/search?q=${code}`}
                  className="font-mono font-bold bg-[var(--paper)] hover:bg-[#D7E600] text-[var(--ink)] border border-[var(--rule-strong)] hover:border-[var(--ink)] px-2.5 py-0.5 rounded-full transition-colors"
                >
                  {code}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Spotlight Column (Resume Reading + Urgent Exam Card) */}
          <div className="flex flex-col gap-3">
            {nextExamSubject && nextExamStatus && (
              <Link
                href={`/subject?id=${nextExamSubject.id}`}
                className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[var(--ink)] text-[var(--paper)] shadow-[3px_3px_0_var(--hl)] hover:translate-y-[-1px] transition-all group"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/65 flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5 text-[#D7E600]" />
                    Next Exam Spotlight
                  </span>
                  <span
                    className={`font-mono text-[10px] font-black px-2 py-0.5 rounded ${
                      nextExamStatus.status === 'today'
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-[#D7E600] text-[#201C14]'
                    }`}
                  >
                    {nextExamStatus.text}
                  </span>
                </div>
                <div className="font-bold text-[16px] text-white group-hover:text-[#D7E600] transition-colors line-clamp-1">
                  {nextExamSubject.name}
                </div>
                <div className="font-mono text-[11px] text-white/70 mt-1 flex items-center justify-between">
                  <span>
                    {deriveSubjectShortCode(nextExamSubject.name, nextExamSubject.code)} ·{' '}
                    {countsMap[nextExamSubject.id]?.notes || 0} Notes ·{' '}
                    {countsMap[nextExamSubject.id]?.pyqs || 0} PYQs
                  </span>
                  <span className="text-[#D7E600] font-bold flex items-center gap-0.5">
                    Study Now <ChevronRightIcon className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            )}

            {lastRead ? (
              <Link
                href={`/read?file=${encodeURIComponent(lastRead.file)}&title=${encodeURIComponent(lastRead.title)}&page=${lastRead.page || 1}${lastRead.subjectId ? `&subjectId=${lastRead.subjectId}` : ''}`}
                className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[#D7E600]/35 hover:bg-[#D7E600]/55 shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3 transition-all"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[10px] font-black uppercase tracking-wider text-[var(--ink)] mb-0.5 flex items-center gap-1">
                    <FileTextIcon className="w-3.5 h-3.5" />
                    Resume Reading
                  </div>
                  <div className="font-bold text-[14px] text-[var(--ink)] truncate">
                    {lastRead.title}
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5">
                    Page {lastRead.page} {lastRead.total > 0 ? `of ${lastRead.total}` : ''}
                  </div>
                </div>
                <span className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[11.5px] px-3 py-2 rounded-xl shrink-0">
                  Resume →
                </span>
              </Link>
            ) : (
              <div className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper)] shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[13.5px] text-[var(--ink)]">
                    {profile?.roll ? `Space: ${profile.roll}` : 'Personalize Your Roll No & Sem'}
                  </div>
                  <div className="text-[11.5px] text-[var(--ink-soft)] mt-0.5">
                    {profile
                      ? `${profile.reg_code} · ${profile.branch_code} · Sem ${profile.sem}`
                      : 'Optional — browse all notes freely or pin your default semester.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="bg-[#D7E600] text-[var(--ink)] border-[1.5px] border-[var(--ink)] font-bold text-[11.5px] px-3 py-2 rounded-xl shadow-[2px_2px_0_var(--ink)] flex items-center gap-1.5 shrink-0 cursor-pointer hover:translate-y-[1px]"
                >
                  <SlidersHorizontalIcon className="w-3.5 h-3.5" />
                  <span>{profile ? 'Edit' : 'Set Space'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Semester Switcher & Regulation Bar */}
      <section className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-[var(--ink)]" />
            <h2 className="font-display font-black text-[24px] text-[var(--ink)] tracking-tight leading-none">
              {activeBranchCode} {activeRegCode} SUBJECTS
            </h2>
          </div>

          <span className="font-mono text-[11px] font-bold bg-[var(--paper-deep)] border border-[var(--rule-strong)] px-2.5 py-0.5 rounded-full text-[var(--ink-soft)]">
            {subjects.length} Subjects
          </span>
        </div>

        {/* Fast Semester Pills + Regulation Quick Switcher */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-[var(--paper-card)] p-1 rounded-xl border-[1.5px] border-[var(--ink)]">
            {availableSems.map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => setActiveSem(sem)}
                className={`font-mono text-[11.5px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeSem === sem
                    ? 'bg-[var(--ink)] text-[#D7E600] shadow-xs'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-deep)]'
                }`}
              >
                {getSemLabel(sem)}
              </button>
            ))}
          </div>

          <Link
            href="/browse"
            className="font-mono text-[11.5px] font-bold px-3 py-2 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper)] hover:bg-[#D7E600] transition-colors"
          >
            All Regulations →
          </Link>
        </div>
      </section>

      {/* Responsive Multi-Column Subject Grid */}
      {loading ? (
        <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-12 bg-[var(--paper-card)] flex flex-col items-center justify-center gap-3">
          <Loader2Icon className="w-7 h-7 animate-spin text-[var(--ink)]" />
          <p className="text-[13px] font-bold text-[var(--ink-soft)]">
            Loading {activeRegCode} Semester {activeSem} subjects...
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
                  {/* Code + Live Exam Badge Row */}
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

                  {/* Subject Title */}
                  <h3 className="font-sans font-extrabold text-[16px] text-[var(--ink)] leading-snug group-hover:underline line-clamp-2">
                    {sub.name}
                  </h3>
                </div>

                {/* Stats Footer */}
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
        <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-10 bg-[var(--paper-card)] text-center mb-8">
          <p className="font-bold text-[15px] text-[var(--ink)] mb-1">
            No subjects found for {activeRegCode} Semester {activeSem}
          </p>
          <p className="text-[12.5px] text-[var(--ink-soft)] mb-4">
            Try switching to Semester 5, 6, or 7 above or explore the full catalog.
          </p>
          <Link href="/browse" className="btn btn-p inline-flex">
            Browse All Courses
          </Link>
        </div>
      ) : null}

      {/* Completed Exams Collapsible Drawer */}
      {completedSubjects.length > 0 && (
        <section className="border-2 border-[var(--rule-strong)] rounded-2xl bg-[var(--paper-card)] overflow-hidden mb-8">
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

      {/* Profile Modal (only triggered optionally by user click on Web!) */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(newProf) => {
          setProfile(newProf);
          setActiveRegId(newProf.reg_id);
          setActiveBranchId(newProf.branch_id);
          setActiveSem(newProf.sem);
          setIsModalOpen(false);
        }}
        initialProfile={profile}
      />
    </div>
  );
}

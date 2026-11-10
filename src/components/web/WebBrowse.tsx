'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, Loader2Icon, BookOpenIcon, AlertCircleIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { University, Regulation, Branch, Subject } from '@/lib/types';
import { deriveSubjectShortCode } from '@/lib/subjectNaming';
import { fetchSyncedExamTimetable, getSubjectExamStatus } from '@/lib/examCountdown';
import { DEFAULT_EXAM_TIMETABLE } from '@/lib/defaultExamTimetable';

export function WebBrowse() {
  const supabase = createClient();

  const [universities, setUniversities] = useState<University[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, { notes: number; pyqs: number }>>({});
  const [examTimetable, setExamTimetable] = useState<any>(DEFAULT_EXAM_TIMETABLE);

  const [selectedUni, setSelectedUni] = useState<string>('');
  const [selectedReg, setSelectedReg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedSem, setSelectedSem] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);

  const readProfile = () => {
    try {
      const p =
        localStorage.getItem('semkit_user_profile') ||
        localStorage.getItem('semkit_profile') ||
        localStorage.getItem('ignitext_profile');
      return p ? JSON.parse(p) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchSyncedExamTimetable(supabase).then(setExamTimetable);

    async function loadInitial() {
      const profile = readProfile();
      const [uniRes, brRes] = await Promise.all([
        supabase.from('universities').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('branches').select('*').eq('is_active', true).order('sort_order'),
      ]);

      const unis = (uniRes.data || []) as University[];
      const brs = (brRes.data || []) as Branch[];
      setUniversities(unis);
      setBranches(brs);

      if (unis.length > 0) setSelectedUni(unis[0].id);

      if (brs.length > 0) {
        const match = profile?.branch_id ? brs.find((b) => b.id === profile.branch_id) : null;
        setSelectedBranch(match ? match.id : brs[0].id);
      }

      if (profile?.sem && Number(profile.sem) >= 1 && Number(profile.sem) <= 8) {
        setSelectedSem(Number(profile.sem));
      }
    }

    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedUni) return;
    const profile = readProfile();

    async function loadRegs() {
      const { data } = await supabase
        .from('regulations')
        .select('*')
        .eq('university_id', selectedUni)
        .eq('is_active', true)
        .order('sort_order');

      const regs = (data || []) as Regulation[];
      setRegulations(regs);

      if (regs.length > 0) {
        const match = profile?.reg_id
          ? regs.find((r) => r.id === profile.reg_id)
          : regs.find((r) => (r.code || '').toUpperCase() === 'R22');
        setSelectedReg(match ? match.id : regs[0].id);
      } else {
        setSelectedReg('');
      }
    }

    loadRegs();
  }, [selectedUni]);

  useEffect(() => {
    if (!selectedReg || !selectedBranch) return;
    let cancelled = false;

    async function fetchSubjects() {
      setLoading(true);
      const { data } = await supabase
        .from('subjects')
        .select('*')
        .eq('regulation_id', selectedReg)
        .eq('branch_id', selectedBranch)
        .eq('semester', selectedSem)
        .eq('is_active', true)
        .order('name');

      if (cancelled) return;
      const list = (data || []) as Subject[];
      setSubjects(list);

      if (list.length > 0) {
        const ids = list.map((s) => s.id);
        const { data: items } = await supabase
          .from('content_items')
          .select('subject_id, type')
          .in('subject_id', ids)
          .eq('status', 'published');

        if (!cancelled && items) {
          const nextMap: Record<string, { notes: number; pyqs: number }> = {};
          for (const it of items) {
            if (!nextMap[it.subject_id]) nextMap[it.subject_id] = { notes: 0, pyqs: 0 };
            if (it.type === 'pyq') nextMap[it.subject_id].pyqs += 1;
            else nextMap[it.subject_id].notes += 1;
          }
          setCountsMap(nextMap);
        }
      } else {
        setCountsMap({});
      }

      if (!cancelled) setLoading(false);
    }

    fetchSubjects();
    return () => {
      cancelled = true;
    };
  }, [selectedReg, selectedBranch, selectedSem]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display font-black text-[32px] sm:text-[38px] text-[var(--ink)] leading-none">
          BROWSE CURRICULUM & ARCHIVE
        </h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
          Explore notes across any university, regulation, branch & semester with instant online preview.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Filter Sidebar */}
        <aside className="border-2 border-[var(--ink)] rounded-2xl p-4 sm:p-5 bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] flex flex-col gap-5">
          {/* University */}
          <div>
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
              University
            </div>
            <div className="flex flex-wrap gap-1.5">
              {universities.map((uni) => (
                <button
                  key={uni.id}
                  type="button"
                  onClick={() => setSelectedUni(uni.id)}
                  className={`font-mono text-[11.5px] font-bold px-3 py-1.5 rounded-xl border-[1.5px] cursor-pointer transition-all ${
                    selectedUni === uni.id
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[#D7E600]'
                      : 'bg-[var(--paper)] border-[var(--rule-strong)] text-[var(--ink)] hover:border-[var(--ink)]'
                  }`}
                >
                  {uni.code}
                </button>
              ))}
            </div>
          </div>

          {/* Regulation */}
          <div>
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
              Regulation
            </div>
            <div className="flex flex-wrap gap-1.5">
              {regulations.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => setSelectedReg(reg.id)}
                  className={`font-mono text-[11.5px] font-bold px-3 py-1.5 rounded-xl border-[1.5px] cursor-pointer transition-all ${
                    selectedReg === reg.id
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[#D7E600]'
                      : 'bg-[var(--paper)] border-[var(--rule-strong)] text-[var(--ink)] hover:border-[var(--ink)]'
                  }`}
                >
                  {reg.code}
                </button>
              ))}
            </div>
          </div>

          {/* Branch */}
          <div>
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
              Branch
            </div>
            <div className="flex flex-wrap gap-1.5">
              {branches.map((br) => (
                <button
                  key={br.id}
                  type="button"
                  onClick={() => setSelectedBranch(br.id)}
                  className={`font-mono text-[11.5px] font-bold px-3 py-1.5 rounded-xl border-[1.5px] cursor-pointer transition-all ${
                    selectedBranch === br.id
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[#D7E600]'
                      : 'bg-[var(--paper)] border-[var(--rule-strong)] text-[var(--ink)] hover:border-[var(--ink)]'
                  }`}
                >
                  {br.code}
                </button>
              ))}
            </div>
          </div>

          {/* Semester */}
          <div>
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
              Semester
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSelectedSem(sem)}
                  className={`font-mono text-[12px] font-bold h-9 rounded-xl border-[1.5px] cursor-pointer transition-all ${
                    selectedSem === sem
                      ? 'bg-[#D7E600] border-[var(--ink)] text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                      : 'bg-[var(--paper)] border-[var(--rule-strong)] text-[var(--ink-soft)] hover:border-[var(--ink)]'
                  }`}
                >
                  S{sem}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Results Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-4 h-4 text-[var(--ink)]" />
              <h2 className="font-mono text-[12px] font-bold uppercase tracking-wider text-[var(--ink)]">
                Available Subjects ({subjects.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-14 bg-[var(--paper-card)] flex flex-col items-center justify-center gap-2">
              <Loader2Icon className="w-6 h-6 animate-spin text-[var(--ink)]" />
              <p className="text-[12.5px] font-bold text-[var(--ink-soft)]">Loading subjects...</p>
            </div>
          ) : subjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {subjects.map((sub) => {
                const shortCode = deriveSubjectShortCode(sub.name, sub.code);
                const counts = countsMap[sub.id] || { notes: 0, pyqs: 0 };
                const examStatus = getSubjectExamStatus(sub, examTimetable);

                return (
                  <Link
                    key={sub.id}
                    href={`/subject?id=${sub.id}`}
                    className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[#FAF9F5] shadow-[3px_3px_0_var(--ink)] hover:shadow-[5px_5px_0_var(--ink)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[11px] font-black bg-[#D7E600] text-[var(--ink)] px-2.5 py-0.5 rounded border border-[var(--ink)]">
                          {shortCode}
                        </span>
                        {examStatus && (
                          <span className="font-mono text-[10px] font-bold bg-[var(--paper-deep)] border border-[var(--rule-strong)] px-2 py-0.5 rounded">
                            {examStatus.text}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-[15px] text-[var(--ink)] leading-snug group-hover:underline">
                        {sub.name}
                      </h3>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--rule)] flex items-center justify-between text-[11.5px]">
                      <span className="font-mono text-[var(--ink-soft)] font-semibold">
                        {counts.notes} Notes · {counts.pyqs} PYQs
                      </span>
                      <span className="font-bold text-[var(--ink)] flex items-center gap-0.5">
                        Open <ChevronRightIcon className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-12 bg-[var(--paper-card)] text-center flex flex-col items-center gap-2">
              <AlertCircleIcon className="w-8 h-8 text-[var(--ink-faint)]" />
              <div className="font-bold text-[15px] text-[var(--ink)]">No subjects found</div>
              <p className="text-[12.5px] text-[var(--ink-soft)] max-w-sm">
                Try choosing R22 CSE Semesters 5, 6, or 7 (all 19 subjects with 176+ notes are published there!).
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

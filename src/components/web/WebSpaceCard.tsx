'use client';

import React, { useState, useEffect } from 'react';
import { UserIcon, ChevronRightIcon, LockIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/components/OnboardingModal';

interface WebSpaceCardProps {
  onSave: (profile: StudentProfile) => void;
  attentionMessage?: string | null;
  rollInputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Shared profile persistence helper (kept compatible with APK keys & cookies).
 */
export function saveStudentSpaceProfile(profileData: StudentProfile, supabase: ReturnType<typeof createClient>) {
  try {
    const serialized = JSON.stringify(profileData);
    localStorage.setItem('semkit_profile', serialized);
    localStorage.setItem('semkit_user_profile', serialized);
    localStorage.setItem('ignitext_profile', serialized);
    localStorage.setItem('ignitext_user_profile', serialized);
    localStorage.setItem('student_ht', profileData.roll);
    localStorage.setItem('ignitext_roll_number', profileData.roll);
    document.cookie = `semkit_profile=${encodeURIComponent(serialized)}; path=/; max-age=31536000`;
    document.cookie = `ignitext_profile=${encodeURIComponent(serialized)}; path=/; max-age=31536000`;

    window.dispatchEvent(new Event('semkit_profile_changed'));
    window.dispatchEvent(new Event('ignitext_profile_changed'));

    // Register student roll number cleanly in background
    Promise.resolve(supabase.rpc('register_student', { p_hall_ticket: profileData.roll })).catch(() => {});
  } catch {
    // Ignore storage quota errors
  }
}

export function readStudentSpaceProfile(): StudentProfile | null {
  if (typeof window === 'undefined') return null;
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
    // Ignore invalid JSON
  }
  return null;
}

export function WebSpaceCard({ onSave, attentionMessage, rollInputRef }: WebSpaceCardProps) {
  const supabase = createClient();

  const [regulations, setRegulations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [roll, setRoll] = useState('');
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTaxonomy() {
      const [regRes, brRes] = await Promise.all([
        supabase.from('regulations').select('*').eq('is_active', true).order('code', { ascending: false }),
        supabase.from('branches').select('*').eq('is_active', true).order('code'),
      ]);

      if (regRes.data) setRegulations(regRes.data);
      if (brRes.data) setBranches(brRes.data);
    }

    loadTaxonomy();
  }, []);

  const isFormValid = roll.trim().length > 0 && selectedReg && selectedBranch && selectedSem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || saving) return;

    setSaving(true);
    const cleanRoll = roll.trim().toUpperCase();
    const profileData: StudentProfile = {
      roll: cleanRoll,
      reg_id: selectedReg.id,
      reg_code: selectedReg.code,
      branch_id: selectedBranch.id,
      branch_code: selectedBranch.code,
      sem: selectedSem!,
    };

    saveStudentSpaceProfile(profileData, supabase);
    setSaving(false);
    onSave(profileData);
  };

  return (
    <section
      id="web-set-space"
      className="border-2 border-[var(--ink)] rounded-3xl bg-[#FAF9F5] shadow-[4px_4px_0_var(--ink)] overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b-2 border-[var(--ink)] bg-[var(--paper-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#D7E600] border-2 border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center shrink-0">
            <UserIcon className="w-6 h-6 text-[var(--ink)]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-wider bg-[var(--ink)] text-[#D7E600] px-2.5 py-0.5 rounded mb-1">
              <LockIcon className="w-3 h-3" />
              <span>Required to Continue</span>
            </div>
            <h2 className="font-display font-black text-[26px] sm:text-[30px] text-[var(--ink)] leading-none">
              SET YOUR SPACE
            </h2>
            <p className="text-[12.5px] sm:text-[13px] text-[var(--ink-soft)] mt-1">
              Set up your Roll Number, Regulation, Branch & Semester once to unlock subjects, search & exam notes.
            </p>
          </div>
        </div>
      </div>

      {/* Attention Banner when user tries searching before setting space */}
      {attentionMessage && (
        <div className="mx-5 sm:mx-6 mt-5 px-4 py-3 rounded-xl bg-amber-100 border-2 border-[var(--ink)] text-[12.5px] font-bold text-[var(--ink)]">
          {attentionMessage}
        </div>
      )}

      {/* Inline Setup Form */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. Roll Number */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              1. ROLL NUMBER (HALL TICKET)
            </label>
            <input
              ref={rollInputRef}
              type="text"
              placeholder="E.G. 23EG105T42"
              value={roll}
              onChange={(e) => setRoll(e.target.value.toUpperCase())}
              className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--ink)] rounded-xl px-4 py-3 text-[15px] font-mono font-bold focus:outline-none focus:bg-white transition-all uppercase placeholder:text-[var(--ink-faint)] placeholder:font-sans placeholder:font-normal"
            />
          </div>

          {/* 2. Regulation */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              2. REGULATION
            </label>
            <div className="flex flex-wrap gap-2">
              {regulations.map((reg) => {
                const isSelected = selectedReg?.id === reg.id;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setSelectedReg(reg)}
                    className={`px-4 py-2.5 rounded-xl font-bold font-mono text-[13.5px] border-[1.5px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] border-[var(--ink)] text-[#D7E600] shadow-[2px_2px_0_var(--hl)]'
                        : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)] hover:border-[var(--ink)]'
                    }`}
                  >
                    {reg.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Branch */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              3. BRANCH
            </label>
            <div className="flex flex-wrap gap-2">
              {branches.map((br) => {
                const isSelected = selectedBranch?.id === br.id;
                return (
                  <button
                    key={br.id}
                    type="button"
                    onClick={() => setSelectedBranch(br)}
                    className={`px-4 py-2.5 rounded-xl font-bold font-mono text-[13.5px] border-[1.5px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] border-[var(--ink)] text-[#D7E600] shadow-[2px_2px_0_var(--hl)]'
                        : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)] hover:border-[var(--ink)]'
                    }`}
                  >
                    {br.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Semester */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              4. SEMESTER
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                const isSelected = selectedSem === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSelectedSem(sem)}
                    className={`py-2.5 rounded-xl font-bold font-mono text-[13.5px] border-[1.5px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] border-[var(--ink)] text-[#D7E600] shadow-[2px_2px_0_var(--hl)]'
                        : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)] hover:border-[var(--ink)]'
                    }`}
                  >
                    {sem}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={!isFormValid || saving}
            className="w-full sm:w-auto sm:min-w-[260px] bg-[#D7E600] text-[var(--ink)] font-black text-[15px] px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-40 disabled:shadow-none disabled:translate-y-0 cursor-pointer"
          >
            <span>{saving ? 'Saving...' : 'Set Up My Space'}</span>
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </section>
  );
}

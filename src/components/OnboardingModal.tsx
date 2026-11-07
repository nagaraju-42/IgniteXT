'use client';

import React, { useState, useEffect } from 'react';
import { UserIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface StudentProfile {
  roll: string;
  reg_id: string;
  reg_code: string;
  branch_id: string;
  branch_code: string;
  sem: number;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSave: (profile: StudentProfile) => void;
  initialProfile?: StudentProfile | null;
}

export function OnboardingModal({ isOpen, onClose, onSave, initialProfile }: OnboardingModalProps) {
  const [regulations, setRegulations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [roll, setRoll] = useState('');
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const [regRes, brRes] = await Promise.all([
        supabase.from('regulations').select('*').eq('is_active', true).order('code', { ascending: false }),
        supabase.from('branches').select('*').eq('is_active', true).order('code'),
      ]);

      if (regRes.data && regRes.data.length > 0) {
        setRegulations(regRes.data);
        // Only select if editing an existing profile, DO NOT auto-select anything by default!
        if (initialProfile?.reg_code || initialProfile?.reg_id) {
          const found = regRes.data.find(
            (r) => r.code === initialProfile.reg_code || r.id === initialProfile.reg_id
          );
          if (found) setSelectedReg(found);
        } else {
          setSelectedReg(null);
        }
      }

      if (brRes.data && brRes.data.length > 0) {
        setBranches(brRes.data);
        // Only select if editing an existing profile, DO NOT auto-select anything by default!
        if (initialProfile?.branch_code || initialProfile?.branch_id) {
          const found = brRes.data.find(
            (b) => b.code === initialProfile.branch_code || b.id === initialProfile.branch_id
          );
          if (found) setSelectedBranch(found);
        } else {
          setSelectedBranch(null);
        }
      }
    }

    if (isOpen) {
      loadData();
      if (initialProfile) {
        setRoll(initialProfile.roll || '');
        setSelectedSem(initialProfile.sem || null);
      } else {
        setRoll('');
        setSelectedReg(null);
        setSelectedBranch(null);
        setSelectedSem(null);
      }
    }
  }, [isOpen, initialProfile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!roll.trim() || !selectedReg || !selectedBranch || !selectedSem) return;

    setSaving(true);
    const cleanRoll = roll.trim().toUpperCase();
    const profileData: StudentProfile = {
      roll: cleanRoll,
      reg_id: selectedReg.id,
      reg_code: selectedReg.code,
      branch_id: selectedBranch.id,
      branch_code: selectedBranch.code,
      sem: selectedSem,
    };

    // Save to localStorage & cookie (both SemKit and legacy keys for compatibility)
    try {
      localStorage.setItem('semkit_profile', JSON.stringify(profileData));
      localStorage.setItem('ignitext_profile', JSON.stringify(profileData));
      localStorage.setItem('student_ht', profileData.roll);
      localStorage.setItem('ignitext_roll_number', profileData.roll);
      document.cookie = `semkit_profile=${encodeURIComponent(JSON.stringify(profileData))}; path=/; max-age=31536000`;
      document.cookie = `ignitext_profile=${encodeURIComponent(JSON.stringify(profileData))}; path=/; max-age=31536000`;

      // Dispatch event to update HeaderBar and Home screen immediately
      window.dispatchEvent(new Event('semkit_profile_changed'));
      window.dispatchEvent(new Event('ignitext_profile_changed'));

      await supabase.rpc('register_student', { p_hall_ticket: profileData.roll }).catch(() => {});
    } catch (e) {
      console.log('Error saving profile:', e);
    }

    setSaving(false);
    onSave(profileData);
    if (onClose) onClose();
  };

  const isFormValid = roll.trim().length > 0 && selectedReg && selectedBranch && selectedSem;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-300">
      <div className="bg-[var(--paper)] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border-[1.5px] border-[var(--rule-strong)] flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-2 border-b border-[var(--rule)] bg-[var(--paper-card)] relative">
          {onClose && initialProfile && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-[var(--paper-deep)] text-[var(--ink-soft)] transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}

          <div className="w-12 h-12 bg-[#D7E600] rounded-full flex items-center justify-center mb-4 border-2 border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
            <UserIcon className="w-6 h-6 text-[var(--ink)]" />
          </div>
          <h2 className="font-bold text-[22px] text-[var(--ink)] leading-tight mb-1">
            Personalize Your Space
          </h2>
          <p className="text-[13px] text-[var(--ink-soft)] mb-2">
            Set up your profile once. We'll automatically show your exact subjects every time you open SemKit.
          </p>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
          {/* 1. Roll Number */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              1. ROLL NUMBER (HALL TICKET)
            </label>
            <input
              type="text"
              placeholder="E.G. 21X41A0501"
              value={roll}
              onChange={(e) => setRoll(e.target.value.toUpperCase())}
              className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-4 py-3 text-[15px] font-mono font-bold focus:outline-none focus:border-[var(--ink)] focus:bg-[var(--paper)] transition-all uppercase placeholder:text-[var(--ink-faint)] placeholder:font-sans placeholder:font-normal"
            />
          </div>

          {/* 2. Regulation */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              2. REGULATION
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x no-scrollbar">
              {regulations.map((reg) => {
                const isSelected = selectedReg?.id === reg.id;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setSelectedReg(reg)}
                    className={`shrink-0 px-4 py-2 rounded-xl font-bold font-mono text-[14px] border-[1.5px] transition-all snap-start cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--paper)] shadow-md scale-105'
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
                    className={`px-3 py-1.5 rounded-lg font-bold font-mono text-[12px] border-[1.5px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--paper)] shadow-md'
                        : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)]'
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
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                const isSelected = selectedSem === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSelectedSem(sem)}
                    className={`py-2 rounded-lg font-bold text-[14px] border-[1.5px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--paper)] shadow-md'
                        : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)]'
                    }`}
                  >
                    {sem}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--rule)] bg-[var(--paper-card)]">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid || saving}
            className="w-full bg-[#D7E600] text-[var(--ink)] font-black text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 border-[2px] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-40 disabled:shadow-none disabled:translate-y-0 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Set Up My Space'}
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { UserIcon, ChevronRightIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [regulations, setRegulations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  const [ht, setHt] = useState('');
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    // Check if profile cookie exists
    const hasProfile = document.cookie.includes('ignitext_profile=');
    if (!hasProfile) {
      setIsOpen(true);
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    const [regsRes, branchesRes] = await Promise.all([
      supabase.from('regulations').select('*').order('code', { ascending: false }),
      supabase.from('branches').select('*').order('code')
    ]);
    if (regsRes.data) setRegulations(regsRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
  };

  if (!isOpen) return null;

  const handleFinish = async () => {
    if (!ht || !selectedReg || !selectedBranch) return;
    setLoading(true);

    const profile = {
      roll: ht.trim().toUpperCase(),
      reg_id: selectedReg.id,
      reg_code: selectedReg.code,
      branch_id: selectedBranch.id,
      branch_code: selectedBranch.code,
      sem: selectedSem
    };

    // Save to cookie (1 year)
    document.cookie = `ignitext_profile=${encodeURIComponent(JSON.stringify(profile))}; path=/; max-age=31536000`;
    // Also save legacy ht just in case
    localStorage.setItem('student_ht', profile.roll);

    // Register roll in DB silently
    try {
      await supabase.rpc('register_student', { p_hall_ticket: profile.roll });
    } catch(e) {}

    setIsOpen(false);
    // Hard refresh to trigger server-side tailored homepage
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-300">
      <div className="bg-[var(--paper)] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border-[1.5px] border-[var(--rule-strong)] flex flex-col max-h-[90vh]">
        
        <div className="p-6 pb-2 border-b border-[var(--rule)] bg-[var(--paper-card)]">
          <div className="w-12 h-12 bg-[#D7E600] rounded-full flex items-center justify-center mb-4 border-2 border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
            <UserIcon className="w-6 h-6 text-[var(--ink)]" />
          </div>
          <h2 className="font-bold text-[22px] text-[var(--ink)] leading-tight mb-1">Personalize Your Space</h2>
          <p className="text-[13px] text-[var(--ink-soft)] mb-2">
            Set up your profile once. We'll automatically show your exact subjects every time you open the app.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
          {/* Roll Number */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              1. Roll Number (Hall Ticket)
            </label>
            <input
              type="text"
              placeholder="e.g. 21X41A0501"
              value={ht}
              onChange={(e) => setHt(e.target.value.toUpperCase())}
              className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-4 py-3 text-[15px] font-mono font-bold focus:outline-none focus:border-[var(--ink)] focus:bg-[var(--paper)] transition-all uppercase placeholder:text-[var(--ink-faint)] placeholder:font-sans placeholder:font-normal"
            />
          </div>

          {/* Regulation */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              2. Regulation
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
              {regulations.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReg(r)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold font-mono text-[14px] border-[1.5px] transition-all snap-start ${
                    selectedReg?.id === r.id 
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--paper)] shadow-md scale-105'
                      : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)] hover:border-[var(--ink)]'
                  }`}
                >
                  {r.code}
                </button>
              ))}
            </div>
          </div>

          {/* Branch */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              3. Branch
            </label>
            <div className="flex flex-wrap gap-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranch(b)}
                  className={`px-3 py-1.5 rounded-lg font-bold font-mono text-[12px] border-[1.5px] transition-all ${
                    selectedBranch?.id === b.id 
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--paper)] shadow-md'
                      : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)]'
                  }`}
                >
                  {b.code}
                </button>
              ))}
            </div>
          </div>

          {/* Semester */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
              4. Semester
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7,8].map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedSem(s)}
                  className={`py-2 rounded-lg font-bold text-[14px] border-[1.5px] transition-all ${
                    selectedSem === s 
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--paper)] shadow-md'
                      : 'bg-[var(--paper-deep)] border-[var(--rule-strong)] text-[var(--ink-soft)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--rule)] bg-[var(--paper-card)]">
          <button
            onClick={handleFinish}
            disabled={!ht || !selectedReg || !selectedBranch || loading}
            className="w-full bg-[#D7E600] text-[var(--ink)] font-black text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 border-[2px] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[3px]"
          >
            {loading ? 'Saving...' : 'Set Up My Space'} <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRightIcon, AlertCircleIcon, Loader2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { University, Regulation, Branch, Subject } from "@/lib/types";

export default function Browse() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [selectedUni, setSelectedUni] = useState<string>('');
  const [selectedReg, setSelectedReg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedSem, setSelectedSem] = useState<number>(7); // Default to sem 7
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const getProfile = () => {
    try {
      const p = localStorage.getItem('semkit_user_profile') || 
                localStorage.getItem('semkit_profile') || 
                localStorage.getItem('ignitext_user_profile') || 
                localStorage.getItem('ignitext_profile');
      if (p) return JSON.parse(p);
    } catch(e) {}
    return null;
  };

  // Load universities & branches initially with student's profile defaults
  useEffect(() => {
    async function loadInitialData() {
      const profile = getProfile();
      const { data: uniData } = await supabase.from('universities').select('*').eq('is_active', true).order('sort_order');
      const { data: branchData } = await supabase.from('branches').select('*').eq('is_active', true).order('sort_order');
      
      setUniversities(uniData || []);
      setBranches(branchData || []);

      if (uniData && uniData.length > 0) setSelectedUni(uniData[0].id);

      // Pre-select student's branch from space setup
      if (branchData && branchData.length > 0) {
        if (profile?.branch_id) {
          const match = branchData.find(b => b.id === profile.branch_id);
          setSelectedBranch(match ? match.id : branchData[0].id);
        } else if (profile?.branch_code) {
          const match = branchData.find(b => b.code?.toUpperCase() === profile.branch_code?.toUpperCase());
          setSelectedBranch(match ? match.id : branchData[0].id);
        } else {
          setSelectedBranch(branchData[0].id);
        }
      }

      // Pre-select student's semester from space setup
      if (profile?.sem && Number(profile.sem) >= 1 && Number(profile.sem) <= 8) {
        setSelectedSem(Number(profile.sem));
      }
    }
    loadInitialData();

    const handleProfileSync = () => {
      const profile = getProfile();
      if (!profile) return;
      if (profile.sem) setSelectedSem(Number(profile.sem));
      if (profile.branch_id) setSelectedBranch(profile.branch_id);
      if (profile.reg_id) setSelectedReg(profile.reg_id);
    };

    window.addEventListener('semkit_profile_changed', handleProfileSync);
    window.addEventListener('ignitext_profile_changed', handleProfileSync);
    window.addEventListener('storage', handleProfileSync);

    return () => {
      window.removeEventListener('semkit_profile_changed', handleProfileSync);
      window.removeEventListener('ignitext_profile_changed', handleProfileSync);
      window.removeEventListener('storage', handleProfileSync);
    };
  }, [supabase]);

  // Fetch regulations when university changes, pre-selecting student's space regulation
  useEffect(() => {
    if (!selectedUni) return;

    const profile = getProfile();

    async function loadRegulations() {
      const { data: regData } = await supabase
        .from('regulations')
        .select('*')
        .eq('university_id', selectedUni)
        .eq('is_active', true)
        .order('sort_order');
        
      setRegulations(regData || []);
      if (regData && regData.length > 0) {
        if (profile?.reg_id) {
          const match = regData.find(r => r.id === profile.reg_id);
          setSelectedReg(match ? match.id : (regData[regData.length - 1]?.id || regData[0].id));
        } else if (profile?.reg_code) {
          const match = regData.find(r => r.code?.toUpperCase() === profile.reg_code?.toUpperCase());
          setSelectedReg(match ? match.id : (regData[regData.length - 1]?.id || regData[0].id));
        } else {
          setSelectedReg(regData[regData.length - 1]?.id || regData[0].id); // Select latest regulation
        }
      } else {
        setSelectedReg('');
      }
    }
    loadRegulations();
  }, [selectedUni, supabase]);

  // Fetch subjects whenever filters change
  useEffect(() => {
    if (!selectedReg || !selectedBranch) return;
    
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
        
      setSubjects(data || []);
      setLoading(false);
    }
    fetchSubjects();
  }, [selectedReg, selectedBranch, selectedSem, supabase]);

  return (
    <div className="px-[18px] pt-4 pb-8 flex flex-col h-full bg-[var(--paper)]">
      <h1 className="font-bold text-[19px] mb-4 text-[var(--ink)]">Browse Subjects</h1>
      
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div>
          <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 uppercase tracking-wide">University</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {universities.map((uni) => (
              <div 
                key={uni.id}
                onClick={() => setSelectedUni(uni.id)}
                className={`font-mono text-[11px] border-[1.5px] rounded-full px-3 py-1 cursor-pointer whitespace-nowrap transition-colors ${
                  selectedUni === uni.id
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] font-semibold'
                    : 'border-[var(--rule-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-card)]'
                }`}
              >
                {uni.code}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 uppercase tracking-wide">Regulation</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {regulations.map((reg) => (
              <div 
                key={reg.id}
                onClick={() => setSelectedReg(reg.id)}
                className={`font-mono text-[11px] border-[1.5px] rounded-full px-3 py-1 cursor-pointer whitespace-nowrap transition-colors ${
                  selectedReg === reg.id
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] font-semibold'
                    : 'border-[var(--rule-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-card)]'
                }`}
              >
                {reg.code}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 uppercase tracking-wide">Branch</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {branches.map((branch) => (
              <div 
                key={branch.id}
                onClick={() => setSelectedBranch(branch.id)}
                className={`font-mono text-[11px] border-[1.5px] rounded-full px-3 py-1 cursor-pointer whitespace-nowrap transition-colors ${
                  selectedBranch === branch.id
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] font-semibold'
                    : 'border-[var(--rule-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-card)]'
                }`}
              >
                {branch.code}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 uppercase tracking-wide">Semester</p>
          <div className="grid grid-cols-8 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => setSelectedSem(sem)}
                className={`font-mono text-[12px] h-8 rounded-lg border-[1.5px] flex items-center justify-center transition-all cursor-pointer ${
                  selectedSem === sem
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] font-bold shadow-xs'
                    : 'border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink-soft)] hover:border-[var(--ink)]'
                }`}
              >
                {sem}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subjects List */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <p className="text-[11px] font-semibold text-[var(--ink-soft)] uppercase tracking-wide">
            Subjects ({subjects.length})
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--ink-soft)]">
            <Loader2Icon className="w-5 h-5 animate-spin mb-2 text-[var(--ink)]" />
            <p className="text-[12px] font-medium">Loading subjects...</p>
          </div>
        ) : subjects.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {subjects.map((sub) => (
              <Link 
                key={sub.id} 
                href={`/subject?id=${sub.id}`}
                className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3.5 bg-[var(--paper)] flex justify-between items-center hover:border-[var(--ink)] hover:shadow-xs transition-all group"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-semibold text-[13.5px] leading-snug group-hover:underline text-[var(--ink)]">
                    {sub.name}
                  </div>
                  <div className="font-mono text-[10.5px] text-[var(--ink-soft)] mt-1 flex gap-2">
                    {sub.code && <span>{sub.code}</span>}
                    <span>•</span>
                    <span>{sub.total_units || 5} units</span>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[var(--ink-faint)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-xl p-8 bg-[var(--paper)] flex flex-col items-center justify-center text-center">
            <AlertCircleIcon className="w-6 h-6 text-[var(--ink-soft)] mb-2" />
            <div className="font-semibold text-[13px] text-[var(--ink)]">No subjects found</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-1 max-w-[220px]">
              No syllabus mapped yet for this regulation, branch and semester.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

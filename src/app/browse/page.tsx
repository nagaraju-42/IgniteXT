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
  const [selectedSem, setSelectedSem] = useState<number>(5); // Default to 3-1 (sem 5)
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // Load universities & branches initially
  useEffect(() => {
    async function loadInitialData() {
      const { data: uniData } = await supabase.from('universities').select('*').eq('is_active', true).order('sort_order');
      const { data: branchData } = await supabase.from('branches').select('*').eq('is_active', true).order('sort_order');
      
      setUniversities(uniData || []);
      setBranches(branchData || []);

      if (uniData && uniData.length > 0) setSelectedUni(uniData[0].id);
      if (branchData && branchData.length > 0) setSelectedBranch(branchData[0].id);
    }
    loadInitialData();
  }, []);

  // Fetch regulations when university changes
  useEffect(() => {
    if (!selectedUni) return;

    async function loadRegulations() {
      const { data: regData } = await supabase
        .from('regulations')
        .select('*')
        .eq('university_id', selectedUni)
        .eq('is_active', true)
        .order('sort_order');
        
      setRegulations(regData || []);
      if (regData && regData.length > 0) {
        setSelectedReg(regData[regData.length - 1]?.id || regData[0].id); // Select latest regulation
      } else {
        setSelectedReg('');
      }
    }
    loadRegulations();
  }, [selectedUni]);

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
  }, [selectedReg, selectedBranch, selectedSem]);

  return (
    <div className="px-[18px] pt-4 pb-8 flex flex-col h-full">
      <h1 className="font-bold text-[19px] mb-4">Browse Subjects</h1>
      
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
                    ? 'border-[var(--ink)] bg-[var(--hl)] text-[var(--hl-ink)] font-semibold'
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
                    ? 'border-[var(--ink)] bg-[var(--hl)] text-[var(--hl-ink)] font-semibold'
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
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <div 
                key={sem}
                onClick={() => setSelectedSem(sem)}
                className={`font-mono text-[11px] border-[1.5px] rounded-full px-3 py-1 cursor-pointer transition-colors ${
                  selectedSem === sem 
                    ? 'border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] font-semibold' 
                    : 'border-[var(--rule-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-card)]'
                }`}
              >
                {Math.ceil(sem/2)}-{sem%2===0?2:1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-xl overflow-hidden flex flex-col">
        <div className="bg-[var(--paper-deep)] px-3 py-2 border-b-[1.5px] border-[var(--rule-strong)] font-semibold text-[12px] flex justify-between items-center">
          <span>Subjects</span>
          <span className="text-[var(--ink-soft)] font-normal flex items-center gap-2">
            {loading && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
            {subjects.length} total
          </span>
        </div>
        
        <div className="flex flex-col divide-y divide-[var(--rule)] overflow-y-auto">
          {!loading && subjects.length === 0 && (
             <div className="p-8 flex flex-col items-center justify-center text-center gap-2">
                <AlertCircleIcon className="w-6 h-6 text-[var(--ink-faint)]" />
                <p className="text-[13px] text-[var(--ink-soft)] font-medium">No subjects found for this selection.</p>
             </div>
          )}

          {subjects.map((subject) => (
            <Link key={subject.id} href={`/subject?id=${subject.id}`} className="flex items-center justify-between p-3 hover:bg-[var(--paper-deep)] transition-colors group">
              <div>
                <div className="font-semibold text-[13.5px] group-hover:text-[var(--hl-ink)] transition-colors">{subject.name}</div>
                <div className="text-[10.5px] text-[var(--ink-soft)] mt-0.5">{subject.code} · {subject.total_units} Units</div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-[var(--ink-faint)] group-hover:text-[var(--ink)] transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, PlusIcon, Loader2Icon } from "lucide-react";

export default function TaxonomyManagement() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'uni' | 'reg' | 'branch' | 'sub'>('sub');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data for dropdowns
  const [universities, setUniversities] = useState<any[]>([]);
  const [regulations, setRegulations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    async function checkAuthAndLoad() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') return router.push('/community');

      // Load reference data
      const [uniRes, regRes, branchRes] = await Promise.all([
        supabase.from('universities').select('*'),
        supabase.from('regulations').select('*'),
        supabase.from('branches').select('*')
      ]);

      setUniversities(uniRes.data || []);
      setRegulations(regRes.data || []);
      setBranches(branchRes.data || []);
      setLoading(false);
    }
    checkAuthAndLoad();
  }, [router, supabase]);

  const showMsg = (msg: string, type: 'error' | 'success') => {
    if (type === 'error') setError(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setError(''); setSuccessMsg(''); }, 3000);
  };

  const handleAddUni = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const { data, error } = await supabase.from('universities').insert({ name, code: name.substring(0, 4).toUpperCase() }).select().single();
    if (error) showMsg(error.message, 'error');
    else { showMsg('University added!', 'success'); setUniversities([...universities, data]); e.currentTarget.reset(); }
  };

  const handleAddReg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string;
    const label = formData.get('label') as string;
    const uniId = formData.get('university_id') as string;
    const { data, error } = await supabase.from('regulations').insert({ code, label, university_id: uniId }).select().single();
    if (error) showMsg(error.message, 'error');
    else { showMsg('Regulation added!', 'success'); setRegulations([...regulations, data]); e.currentTarget.reset(); }
  };

  const handleAddBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string;
    const label = formData.get('name') as string;
    const { data, error } = await supabase.from('branches').insert({ code, label }).select().single();
    if (error) showMsg(error.message, 'error');
    else { showMsg('Branch added!', 'success'); setBranches([...branches, data]); e.currentTarget.reset(); }
  };

  const handleAddSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { error } = await supabase.from('subjects').insert({
      regulation_id: formData.get('regulation_id'),
      branch_id: formData.get('branch_id'),
      semester: formData.get('semester'),
      code: formData.get('code'),
      name: formData.get('name'),
    });
    if (error) showMsg(error.message, 'error');
    else { showMsg('Subject added!', 'success'); e.currentTarget.reset(); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] min-h-screen">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center shadow-sm sticky top-0 z-10">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Taxonomy</div>
      </div>

      <div className="flex border-b border-[var(--rule-strong)] overflow-x-auto no-scrollbar">
        {[
          { id: 'uni', label: 'Universities' },
          { id: 'reg', label: 'Regulations' },
          { id: 'branch', label: 'Branches' },
          { id: 'sub', label: 'Subjects' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-[13px] font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-b-2 border-[var(--ink)] text-[var(--ink)] bg-[var(--paper-deep)]' : 'text-[var(--ink-soft)]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto px-[18px] py-6">
        {error && <div className="bg-[var(--red-bg)] text-[var(--red)] p-3 rounded-lg text-[13px] font-medium mb-4">{error}</div>}
        {successMsg && <div className="bg-[var(--hl)] text-[var(--ink)] p-3 rounded-lg text-[13px] font-bold mb-4">{successMsg}</div>}

        {activeTab === 'uni' && (
          <form onSubmit={handleAddUni} className="flex flex-col gap-4 border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)]">
            <h2 className="font-bold text-[16px]">Add University</h2>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">University Name</label>
              <input required name="name" type="text" placeholder="e.g. Anurag University" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <button type="submit" className="btn btn-p mt-2"><PlusIcon className="w-4 h-4"/> Add University</button>
          </form>
        )}

        {activeTab === 'reg' && (
          <form onSubmit={handleAddReg} className="flex flex-col gap-4 border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)]">
            <h2 className="font-bold text-[16px]">Add Regulation</h2>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">University</label>
              <select required name="university_id" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none appearance-none">
                <option value="">Select University...</option>
                {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Regulation Code</label>
              <input required name="code" type="text" placeholder="e.g. R22" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Label</label>
              <input required name="label" type="text" placeholder="e.g. Regulation 2022" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <button type="submit" className="btn btn-p mt-2"><PlusIcon className="w-4 h-4"/> Add Regulation</button>
          </form>
        )}

        {activeTab === 'branch' && (
          <form onSubmit={handleAddBranch} className="flex flex-col gap-4 border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)]">
            <h2 className="font-bold text-[16px]">Add Branch</h2>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Branch Code</label>
              <input required name="code" type="text" placeholder="e.g. CSE" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Full Name</label>
              <input required name="name" type="text" placeholder="e.g. Computer Science & Engineering" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <button type="submit" className="btn btn-p mt-2"><PlusIcon className="w-4 h-4"/> Add Branch</button>
          </form>
        )}

        {activeTab === 'sub' && (
          <form onSubmit={handleAddSubject} className="flex flex-col gap-4 border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)]">
            <h2 className="font-bold text-[16px]">Add Subject</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Regulation</label>
                <select required name="regulation_id" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none appearance-none">
                  <option value="">Select...</option>
                  {regulations.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Branch</label>
                <select required name="branch_id" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none appearance-none">
                  <option value="">Select...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Semester</label>
              <select required name="semester" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none appearance-none">
                <option value="">Select Semester...</option>
                <option value="1">Semester 1 (1-1)</option>
                <option value="2">Semester 2 (1-2)</option>
                <option value="3">Semester 3 (2-1)</option>
                <option value="4">Semester 4 (2-2)</option>
                <option value="5">Semester 5 (3-1)</option>
                <option value="6">Semester 6 (3-2)</option>
                <option value="7">Semester 7 (4-1)</option>
                <option value="8">Semester 8 (4-2)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Subject Code</label>
              <input required name="code" type="text" placeholder="e.g. CS301" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Subject Name</label>
              <input required name="name" type="text" placeholder="e.g. Data Structures" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
            </div>
            <button type="submit" className="btn btn-p mt-2"><PlusIcon className="w-4 h-4"/> Add Subject</button>
          </form>
        )}
      </div>
    </div>
  );
}

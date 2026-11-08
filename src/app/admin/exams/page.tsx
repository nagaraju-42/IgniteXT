'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  ChevronLeftIcon, 
  CalendarIcon, 
  ClockIcon, 
  SaveIcon, 
  Loader2Icon, 
  CheckCircle2Icon,
  SparklesIcon,
  FlameIcon,
  LayersIcon
} from "lucide-react";

interface SubjectExamConfig {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  mid1_date?: string;
  mid2_date?: string;
  sem_exam_date?: string;
  exam_session?: string;
}

interface SemGlobalDates {
  sem_start?: string;
  sem_end?: string;
  mid1_start?: string;
  mid1_end?: string;
  mid2_start?: string;
  mid2_end?: string;
  sem_exams_start?: string;
  sem_exams_end?: string;
}

export default function AdminExamsManagement() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Taxonomies
  const [regulations, setRegulations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedReg, setSelectedReg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedSem, setSelectedSem] = useState<number>(7);

  // Timetable State
  const [subjects, setSubjects] = useState<any[]>([]);
  const [globalDates, setGlobalDates] = useState<SemGlobalDates>({});
  const [subjectConfigs, setSubjectConfigs] = useState<Record<string, SubjectExamConfig>>({});

  useEffect(() => {
    async function checkAuthAndLoad() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!prof || (prof.role !== 'superadmin' && prof.role !== 'community_admin')) {
        return router.push('/community');
      }

      const [regRes, branchRes] = await Promise.all([
        supabase.from('regulations').select('*').eq('is_active', true).order('code', { ascending: false }),
        supabase.from('branches').select('*').eq('is_active', true).order('code')
      ]);

      setRegulations(regRes.data || []);
      setBranches(branchRes.data || []);

      if (regRes.data && regRes.data.length > 0) setSelectedReg(regRes.data[0].id);
      if (branchRes.data && branchRes.data.length > 0) setSelectedBranch(branchRes.data[0].id);

      setLoading(false);
    }
    checkAuthAndLoad();
  }, [router, supabase]);

  // Load timetable data whenever Reg, Branch, or Sem changes
  useEffect(() => {
    if (!selectedReg || !selectedBranch) return;

    async function loadSubjectsAndSchedule() {
      setLoading(true);

      // 1. Fetch subjects for this combination
      const { data: subData } = await supabase
        .from('subjects')
        .select('*')
        .eq('regulation_id', selectedReg)
        .eq('branch_id', selectedBranch)
        .eq('semester', selectedSem)
        .order('name');

      setSubjects(subData || []);

      // 2. Fetch master timetable from platform_settings
      const { data: settingData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'exam_timetable_v2')
        .maybeSingle();

      const timetableKey = `${selectedReg}_${selectedBranch}_${selectedSem}`;

      if (settingData && settingData.value) {
        try {
          const allTimetables = JSON.parse(settingData.value);
          const currentSpace = allTimetables[timetableKey] || {};
          setGlobalDates(currentSpace.globalDates || {});
          setSubjectConfigs(currentSpace.subjectConfigs || {});
        } catch(e) {
          console.error("Failed to parse timetable:", e);
        }
      } else {
        setGlobalDates({});
        setSubjectConfigs({});
      }

      setLoading(false);
    }

    loadSubjectsAndSchedule();
  }, [selectedReg, selectedBranch, selectedSem]);

  const handleSubjectDateChange = (subjectId: string, field: keyof SubjectExamConfig, value: string) => {
    const sub = subjects.find(s => s.id === subjectId);
    setSubjectConfigs(prev => ({
      ...prev,
      [subjectId]: {
        ...(prev[subjectId] || {
          subject_id: subjectId,
          subject_code: sub?.code || '',
          subject_name: sub?.name || ''
        }),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const timetableKey = `${selectedReg}_${selectedBranch}_${selectedSem}`;

    try {
      // 1. Read existing platform_settings
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'exam_timetable_v2')
        .maybeSingle();

      let currentData: Record<string, any> = {};
      if (existing && existing.value) {
        try { currentData = JSON.parse(existing.value); } catch(e) {}
      }

      // 2. Update current space configuration
      currentData[timetableKey] = {
        updated_at: new Date().toISOString(),
        globalDates,
        subjectConfigs
      };

      // Also create a fast lookup map by subject code & name for students
      const flatLookup = currentData.flatLookup || {};
      Object.values(subjectConfigs).forEach(cfg => {
        if (cfg.subject_code) flatLookup[cfg.subject_code.toUpperCase().trim()] = cfg;
        if (cfg.subject_name) flatLookup[cfg.subject_name.toLowerCase().trim()] = cfg;
        if (cfg.subject_id) flatLookup[cfg.subject_id] = cfg;
      });
      currentData.flatLookup = flatLookup;

      // 3. Upsert to platform_settings
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'exam_timetable_v2',
          value: JSON.stringify(currentData),
          description: 'Official Mid and Semester Exam timetable configured by Superadmin'
        }, { onConflict: 'key' });

      if (error) throw error;

      setSuccessMsg('Timetable saved successfully! Students will now see auto-sorted subjects & live countdowns.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch(err: any) {
      console.error(err);
      alert('Error saving timetable: ' + err.message);
    }
    setSaving(false);
  };

  if (loading && regulations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
        <p className="text-[14px] font-semibold text-[var(--ink-soft)]">Loading exam management...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--paper-deep)] min-h-screen pb-20">
      {/* Sticky Header */}
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center justify-between shadow-sm sticky top-0 z-20 shrink-0">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Admin
        </Link>
        <div className="font-bold text-[16px] text-[var(--ink)] flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[var(--ink)]" />
          Exam Timetable & Schedule
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[12px] px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-[2px_2px_0_var(--ink)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2Icon className="w-4 h-4 animate-spin text-[#D7E600]" /> : <SaveIcon className="w-4 h-4 text-[#D7E600]" />}
          <span>{saving ? 'Saving...' : 'Save All'}</span>
        </button>
      </div>

      <div className="p-[18px] max-w-4xl mx-auto w-full flex flex-col gap-6">

        {/* Success Alert */}
        {successMsg && (
          <div className="border-[2px] border-emerald-600 bg-emerald-50 text-emerald-900 rounded-2xl p-4 flex items-center gap-3 shadow-[3px_3px_0_emerald-600] animate-in fade-in">
            <CheckCircle2Icon className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="text-[13px] font-bold">{successMsg}</div>
          </div>
        )}

        {/* Space Selector */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper)] shadow-[3px_3px_0_var(--ink)]">
          <h2 className="font-bold text-[14px] text-[var(--ink)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <LayersIcon className="w-4 h-4" /> 1. Select Branch, Regulation & Semester
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase block mb-1">Regulation</label>
              <select
                value={selectedReg}
                onChange={(e) => setSelectedReg(e.target.value)}
                className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-3 py-2 text-[13px] font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
              >
                {regulations.map(r => (
                  <option key={r.id} value={r.id}>{r.code} - {r.label || r.code}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase block mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-3 py-2 text-[13px] font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.code} - {b.label || b.code}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase block mb-1">Semester</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSem(s)}
                    className={`w-9 h-9 rounded-xl font-mono text-[12px] font-bold border-[1.5px] flex items-center justify-center transition-all ${
                      selectedSem === s 
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-[2px_2px_0_var(--ink)]' 
                        : 'border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink-soft)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Global Semester Schedule */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-5 bg-[var(--paper)] shadow-[3px_3px_0_var(--ink)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[14px] text-[var(--ink)] uppercase tracking-wider flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> 2. Semester & Exam Week Dates
            </h2>
            <span className="font-mono text-[10px] bg-[#D7E600] px-2 py-0.5 rounded-full border border-[var(--ink)] font-bold text-[var(--ink)]">
              General Dates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Semester Start & End */}
            <div className="p-3.5 rounded-xl border border-[var(--rule-strong)] bg-[var(--paper-deep)] flex flex-col gap-2">
              <div className="font-bold text-[12px] text-[var(--ink)]">Semester Period</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--ink-soft)]">Start Date</label>
                <input
                  type="date"
                  value={globalDates.sem_start || ''}
                  onChange={(e) => setGlobalDates(prev => ({ ...prev, sem_start: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                />
                <label className="text-[10px] font-mono text-[var(--ink-soft)] mt-1">End Date</label>
                <input
                  type="date"
                  value={globalDates.sem_end || ''}
                  onChange={(e) => setGlobalDates(prev => ({ ...prev, sem_end: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
            </div>

            {/* Mid 1 & Mid 2 */}
            <div className="p-3.5 rounded-xl border border-[var(--rule-strong)] bg-[var(--paper-deep)] flex flex-col gap-2">
              <div className="font-bold text-[12px] text-[var(--ink)]">Mid-1 & Mid-2 Weeks</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--ink-soft)]">Mid-1 Exam Week Starts</label>
                <input
                  type="date"
                  value={globalDates.mid1_start || ''}
                  onChange={(e) => setGlobalDates(prev => ({ ...prev, mid1_start: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                />
                <label className="text-[10px] font-mono text-[var(--ink-soft)] mt-1">Mid-2 Exam Week Starts</label>
                <input
                  type="date"
                  value={globalDates.mid2_start || ''}
                  onChange={(e) => setGlobalDates(prev => ({ ...prev, mid2_start: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
            </div>

            {/* Semester Final Exams */}
            <div className="p-3.5 rounded-xl border border-[var(--rule-strong)] bg-[var(--paper-deep)] flex flex-col gap-2">
              <div className="font-bold text-[12px] text-[var(--ink)]">Semester Final Exams</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--ink-soft)]">Final Exams Start</label>
                <input
                  type="date"
                  value={globalDates.sem_exams_start || ''}
                  onChange={(e) => setGlobalDates(prev => ({ ...prev, sem_exams_start: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                />
                <label className="text-[10px] font-mono text-[var(--ink-soft)] mt-1">Final Exams End</label>
                <input
                  type="date"
                  value={globalDates.sem_exams_end || ''}
                  onChange={(e) => setGlobalDates(prev => ({ ...prev, sem_exams_end: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Subject-by-Subject Specific Dates */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-5 bg-[var(--paper)] shadow-[3px_3px_0_var(--ink)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-[15px] text-[var(--ink)] uppercase tracking-wider flex items-center gap-2">
                <FlameIcon className="w-4 h-4 text-amber-500" /> 3. Subject-Specific Exam Dates
              </h2>
              <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                Set exact dates for each subject so students get countdown badges and auto-sorted subject cards.
              </p>
            </div>
            <span className="font-mono text-[11px] font-bold bg-[var(--ink)] text-[var(--paper)] px-3 py-1 rounded-full">
              {subjects.length} Subjects
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {subjects.length > 0 ? (
              subjects.map((sub) => {
                const cfg = subjectConfigs[sub.id] || {};
                return (
                  <div
                    key={sub.id}
                    className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col gap-3 hover:border-[var(--ink)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {sub.code && (
                          <span className="font-mono text-[11px] font-bold bg-[#D7E600] text-[var(--ink)] px-2.5 py-0.5 rounded-md border border-[var(--ink)] shrink-0">
                            {sub.code}
                          </span>
                        )}
                        <h3 className="font-bold text-[14px] text-[var(--ink)] truncate">
                          {sub.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--ink-soft)] shrink-0">
                        {sub.total_units || 5} Units
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--rule)]">
                      <div>
                        <label className="text-[10px] font-mono uppercase text-[var(--ink-soft)] block mb-1">
                          Mid-1 Exam Date
                        </label>
                        <input
                          type="date"
                          value={cfg.mid1_date || ''}
                          onChange={(e) => handleSubjectDateChange(sub.id, 'mid1_date', e.target.value)}
                          className="w-full bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-[var(--ink-soft)] block mb-1">
                          Mid-2 Exam Date
                        </label>
                        <input
                          type="date"
                          value={cfg.mid2_date || ''}
                          onChange={(e) => handleSubjectDateChange(sub.id, 'mid2_date', e.target.value)}
                          className="w-full bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-[var(--ink-soft)] block mb-1 text-emerald-800 font-bold">
                          Semester Final Date
                        </label>
                        <input
                          type="date"
                          value={cfg.sem_exam_date || ''}
                          onChange={(e) => handleSubjectDateChange(sub.id, 'sem_exam_date', e.target.value)}
                          className="w-full bg-[var(--paper)] border-[1.5px] border-emerald-500 rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--ink)] focus:outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-[var(--ink-soft)] block mb-1">
                          Exam Session
                        </label>
                        <select
                          value={cfg.exam_session || 'morning'}
                          onChange={(e) => handleSubjectDateChange(sub.id, 'exam_session', e.target.value)}
                          className="w-full bg-[var(--paper)] border border-[var(--rule-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink)] focus:outline-none"
                        >
                          <option value="morning">Morning (10:00 AM - 1:00 PM)</option>
                          <option value="afternoon">Afternoon (2:00 PM - 5:00 PM)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-[var(--ink-soft)] text-[13px] border border-dashed border-[var(--rule-strong)] rounded-xl">
                No subjects found for this regulation, branch, and semester.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Save Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[14px] px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-[4px_4px_0_var(--ink)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2Icon className="w-5 h-5 animate-spin text-[#D7E600]" /> : <SaveIcon className="w-5 h-5 text-[#D7E600]" />}
            <span>{saving ? 'Saving Timetable...' : 'Save All Exam Dates'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

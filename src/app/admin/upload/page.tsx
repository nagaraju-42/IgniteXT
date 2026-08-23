'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, UploadCloudIcon, CheckCircleIcon, Loader2Icon } from "lucide-react";

export default function AdminUpload() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [error, setError] = useState('');

  const [subjects, setSubjects] = useState<any[]>([]);
  
  // Form State
  const [userId, setUserId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [materialType, setMaterialType] = useState('notes');
  const [unitOrYear, setUnitOrYear] = useState('Unit 1');
  const [file, setFile] = useState<File | null>(null);

  const selectedSubject = subjects.find(s => s.id === subjectId);
  let derivedUnitTitle = '';
  if (materialType === 'notes' && selectedSubject?.unit_names) {
    const unitNum = parseInt(unitOrYear.replace('Unit ', '')) || 1;
    derivedUnitTitle = selectedSubject.unit_names[unitNum.toString()] || '';
  }

  useEffect(() => {
    async function checkAuthAndLoadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/community/login');
        return;
      }
      setUserId(user.id);

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!prof || (prof.status !== 'active' && prof.role !== 'superadmin')) {
        router.push('/community/login');
        return;
      }

      // Fetch subjects for dropdown
      const { data: subs } = await supabase.from('subjects').select('id, name, code, semester, unit_names, total_units');
      setSubjects(subs || []);

      setLoading(false);
    }
    checkAuthAndLoadData();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !subjectId) return;

    setStatus('uploading');
    setError('');

    try {
      // 1. Get signed URL from Edge Function
      const { data: functionData, error: functionError } = await supabase.functions.invoke('get-upload-url', {
        body: { fileName: file.name, contentType: file.type }
      });

      if (functionError) throw new Error(functionError.message || 'Failed to get upload URL');

      const { uploadUrl, key } = functionData;

      // 2. PUT file directly to Cloudflare R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // 3. Insert metadata into Supabase content_items table
      const subject = subjects.find(s => s.id === subjectId);
      const title = `${subject.code} ${materialType === 'notes' ? 'Notes' : 'PYQ'} - ${unitOrYear}`;

      const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
      const initialStatus = userProfile?.role === 'superadmin' ? 'published' : 'draft';

      let unitNumber = null;
      let examYear = null;
      if (materialType === 'notes') {
        unitNumber = parseInt(unitOrYear.replace('Unit ', '')) || 1;
      } else {
        examYear = parseInt(unitOrYear) || new Date().getFullYear();
      }

      const { data: dbData, error: dbError } = await supabase
        .from('content_items')
        .insert({
          subject_id: subjectId,
          uploaded_by: userId,
          type: materialType === 'notes' ? 'note' : 'pyq',
          title: title,
          unit_number: unitNumber,
          unit_title: materialType === 'notes' ? derivedUnitTitle : null,
          exam_year: examYear,
          file_url: key,
          file_size_kb: Math.round(file.size / 1024),
          status: initialStatus
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Log the upload activity
      await supabase.from('admin_activity_log').insert({
        admin_id: userId,
        action: 'UPLOAD_CONTENT',
        target_type: 'content_items',
        target_id: dbData.id,
        meta: { title: title, subject_id: subjectId }
      });

      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
      setStatus('idle');
    }
  };

  const resetForm = () => {
    setFile(null);
    setStatus('idle');
    setSubjectId('');
    setError('');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
        <p className="text-[14px] font-semibold text-[var(--ink-soft)]">Checking permissions...</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="px-[18px] py-12 h-full flex flex-col items-center justify-center text-center bg-[var(--paper)] min-h-screen">
        <CheckCircleIcon className="w-16 h-16 text-[var(--hl-deep)] mb-4" />
        <h1 className="font-bold text-[20px] mb-2">Upload Successful!</h1>
        <p className="text-[13px] text-[var(--ink-soft)] mb-8">The file has been uploaded to Cloudflare R2 and published to students.</p>
        <button onClick={resetForm} className="btn btn-s mb-3">Upload Another</button>
        <Link href="/admin" className="text-[13px] font-semibold text-[var(--ink-soft)] underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--paper-card)] relative min-h-screen">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center shadow-sm">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Upload Material</div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-[18px] py-6 bg-[var(--paper)]">
        
        {error && (
          <div className="bg-[var(--red-bg)] text-[var(--red)] p-3 rounded-lg text-[13px] font-medium mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Subject</label>
            <select 
              required 
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="w-full bg-[var(--paper-card)] border-[1.5px] border-[var(--ink)] rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none appearance-none"
            >
              <option value="">Select a subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code}) - {s.semester}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Material Type</label>
            <div className="flex gap-3">
              <label onClick={() => setMaterialType('notes')} className={`flex-1 flex items-center gap-2 border-[1.5px] ${materialType === 'notes' ? 'border-[var(--ink)] bg-[var(--paper-card)]' : 'border-[var(--rule-strong)] opacity-70'} rounded-lg p-3 cursor-pointer`}>
                <input type="radio" name="type" value="notes" checked={materialType === 'notes'} readOnly className="accent-[var(--ink)]" />
                <span className="text-[13px] font-medium">Unit Notes</span>
              </label>
              <label onClick={() => setMaterialType('pyq')} className={`flex-1 flex items-center gap-2 border-[1.5px] ${materialType === 'pyq' ? 'border-[var(--ink)] bg-[var(--paper-card)]' : 'border-[var(--rule-strong)] opacity-70'} rounded-lg p-3 cursor-pointer`}>
                <input type="radio" name="type" value="pyq" checked={materialType === 'pyq'} readOnly className="accent-[var(--ink)]" />
                <span className="text-[13px] font-medium">PYQ Paper</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">
              {materialType === 'notes' ? 'Unit Number' : 'Year'}
            </label>
            {materialType === 'notes' ? (
              <div className="flex flex-col gap-3">
                <select 
                  required 
                  value={unitOrYear}
                  onChange={e => setUnitOrYear(e.target.value)}
                  className="w-full bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none appearance-none"
                >
                  {Array.from({ length: selectedSubject?.total_units || 5 }).map((_, i) => (
                    <option key={i} value={`Unit ${i + 1}`}>Unit {i + 1}</option>
                  ))}
                </select>
                {derivedUnitTitle && (
                  <div className="bg-[var(--hl)] text-[var(--ink)] p-3 rounded-lg text-[12px] font-medium flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 shrink-0" /> 
                    <span>Syllabus Name: <strong>{derivedUnitTitle}</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <input 
                type="text" 
                required 
                placeholder="e.g. 2024"
                value={unitOrYear}
                onChange={e => setUnitOrYear(e.target.value)}
                className="w-full bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">PDF File</label>
            <div className={`border-[1.5px] border-dashed ${file ? 'border-[var(--ink)] bg-[var(--hl)]' : 'border-[var(--ink)] bg-[var(--paper-card)]'} rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-colors relative`}>
              <UploadCloudIcon className="w-8 h-8 mb-2" />
              <div className="font-semibold text-[13px] mb-0.5">
                {file ? file.name : 'Tap to select PDF'}
              </div>
              <div className="text-[11px] text-[var(--ink-soft)]">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Max size 25MB'}
              </div>
              <input 
                type="file" 
                accept="application/pdf" 
                required
                onChange={e => e.target.files && setFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer" 
              />
            </div>
          </div>

          <button type="submit" disabled={status === 'uploading' || !file} className="btn btn-p w-full justify-center mt-2 h-[46px] disabled:opacity-50 disabled:cursor-not-allowed">
            {status === 'uploading' ? <><Loader2Icon className="w-4 h-4 animate-spin" /> Uploading to R2...</> : 'Publish Material'}
          </button>
        </form>
      </div>
    </div>
  );
}

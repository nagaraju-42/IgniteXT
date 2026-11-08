'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  ChevronLeftIcon, 
  UploadCloudIcon, 
  CheckCircleIcon, 
  Loader2Icon, 
  FilesIcon,
  XIcon,
  SparklesIcon
} from "lucide-react";
import { 
  deriveSubjectShortCode, 
  generateMaterialTitle, 
  generateR2ObjectKey 
} from "@/lib/subjectNaming";

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
  const [materialType, setMaterialType] = useState<'notes' | 'pyq' | 'imp'>('notes');
  const [unitOrYear, setUnitOrYear] = useState('Unit 1');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [uploadedTitles, setUploadedTitles] = useState<string[]>([]);

  const selectedSubject = subjects.find(s => s.id === subjectId);
  const derivedShortCode = selectedSubject ? deriveSubjectShortCode(selectedSubject.name, selectedSubject.short_name) : '';

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

      // Fetch subjects with regulation & branch data (resilient without requiring short_name column)
      let loadedSubs: any[] = [];
      const { data: subs, error: subsErr } = await supabase
        .from('subjects')
        .select('id, name, code, semester, unit_names, total_units, branches(code), regulations(code)')
        .order('name');

      if (subs && subs.length > 0) {
        loadedSubs = subs;
      } else {
        const { data: basicSubs } = await supabase
          .from('subjects')
          .select('id, name, code, semester, unit_names, total_units')
          .order('name');
        loadedSubs = basicSubs || [];
      }
      setSubjects(loadedSubs);

      setLoading(false);
    }
    checkAuthAndLoadData();
  }, [router, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || !subjectId || !selectedSubject) return;

    setStatus('uploading');
    setError('');
    setUploadedTitles([]);

    try {
      const shortCode = deriveSubjectShortCode(selectedSubject.name, selectedSubject.short_name);
      const branchCode = selectedSubject.branches?.code || 'CSE';
      const regCode = selectedSubject.regulations?.code || 'R22';
      const semester = selectedSubject.semester || 1;

      const unitNumber = materialType === 'notes' 
        ? (parseInt(unitOrYear.replace('Unit ', '')) || 1) 
        : null;

      // 1. Query Supabase to count how many files ALREADY exist for exact subject + type + unit
      let countQuery = supabase
        .from('content_items')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subjectId);

      if (materialType === 'notes') {
        countQuery = countQuery.eq('type', 'note').eq('unit_number', unitNumber);
      } else if (materialType === 'pyq') {
        countQuery = countQuery.eq('type', 'pyq');
      } else {
        countQuery = countQuery.eq('type', 'imp');
      }

      const { count: existingDbCount } = await countQuery;
      let currentSeq = existingDbCount || 0;

      // Always publish immediately when uploaded through Admin Upload portal
      const initialStatus = 'published';

      const completedTitles: string[] = [];

      // 2. Loop through files sequentially, auto-naming each
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        currentSeq += 1;

        // Auto-generate sequential title: CIS Unit-1-1, CIS PYQ-1, etc.
        const autoTitle = generateMaterialTitle({
          shortCode,
          category: materialType,
          unitNumber,
          seqNumber: currentSeq
        });

        // Format clean R2 object key: ${branch}/${regulation}/${semester}/${shortCode}/${autoTitle}.pdf
        const cleanR2Path = generateR2ObjectKey({
          branch: branchCode,
          regulation: regCode,
          semester,
          shortCode,
          autoTitle
        });

        setUploadProgress({
          current: i + 1,
          total: files.length,
          title: autoTitle
        });

        // 3. Upload file directly via Server API (streams to R2 and publishes to Supabase with 0 CORS issues)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('subjectId', subjectId);
        formData.append('materialType', materialType);
        if (unitNumber) formData.append('unitNumber', unitNumber.toString());
        if (derivedUnitTitle) formData.append('unitTitle', derivedUnitTitle);
        if (materialType === 'pyq') {
          formData.append('examYear', (parseInt(unitOrYear) || new Date().getFullYear()).toString());
        }
        formData.append('userId', userId);
        formData.append('autoTitle', autoTitle);
        formData.append('cleanR2Path', cleanR2Path);

        const isApkOrCapacitor = typeof window !== 'undefined' && (
          window.location.protocol === 'capacitor:' || 
          window.location.protocol === 'file:' || 
          (window.location.hostname === 'localhost' && window.location.port !== '3000')
        );
        const apiEndpoint = isApkOrCapacitor 
          ? 'https://ignite-xt-topaz.vercel.app/api/admin/upload' 
          : '/api/admin/upload';

        const uploadRes = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status HTTP ${uploadRes.status}`);
        }

        const resData = await uploadRes.json();
        completedTitles.push(resData.title || autoTitle);
      }

      setUploadedTitles(completedTitles);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
      setStatus('idle');
    }
  };

  const resetForm = () => {
    setFiles([]);
    setStatus('idle');
    setSubjectId('');
    setError('');
    setUploadProgress(null);
    setUploadedTitles([]);
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
        <CheckCircleIcon className="w-16 h-16 text-[#D7E600] mb-4" />
        <h1 className="font-bold text-[22px] mb-2 text-[var(--ink)]">Upload Successful!</h1>
        <p className="text-[13px] text-[var(--ink-soft)] mb-6">
          {uploadedTitles.length} {uploadedTitles.length === 1 ? 'file' : 'files'} auto-named and published to Cloudflare R2.
        </p>

        {/* Display Auto-Generated Sequential Titles */}
        <div className="w-full max-w-sm bg-[var(--paper-card)] border-[2px] border-[var(--ink)] rounded-2xl p-4 mb-6 shadow-[3px_3px_0_var(--ink)] text-left flex flex-col gap-2">
          <div className="text-[11px] font-mono font-bold uppercase text-[var(--ink-soft)] mb-1">
            Generated Titles:
          </div>
          {uploadedTitles.map((t, idx) => (
            <div key={idx} className="flex items-center gap-2 font-mono text-[12px] font-bold text-[var(--ink)] bg-[var(--paper)] px-3 py-1.5 rounded-lg border border-[var(--rule)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <button onClick={resetForm} className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[13px] px-6 py-3 rounded-xl mb-3 shadow-[2px_2px_0_var(--ink)] active:scale-95 transition-all cursor-pointer">
          Upload More Materials
        </button>
        <Link href="/admin" className="text-[13px] font-semibold text-[var(--ink-soft)] underline hover:text-[var(--ink)]">
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--paper-card)] relative min-h-screen pb-16">
      {/* Top Bar */}
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center justify-between shadow-sm sticky top-0 z-10">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] text-[var(--ink)]">Automatic Notes Upload</div>
        <div className="w-12"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-[18px] py-6 bg-[var(--paper)] max-w-xl mx-auto w-full">
        
        {error && error.includes('R2_CORS_ERROR') ? (
          <div className="bg-[#FAF9F5] border-2 border-[var(--ink)] p-4 rounded-2xl mb-6 shadow-[3px_3px_0_var(--ink)]">
            <div className="flex items-center gap-2 text-red-600 font-black text-[14px] mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
              Cloudflare R2 CORS Setup Required
            </div>
            <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed mb-3">
              Web browsers block direct uploads to Cloudflare R2 until a <strong>CORS Policy</strong> is saved in Cloudflare.
            </p>
            <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl p-3 text-[11.5px] font-mono text-[var(--ink)] mb-3 flex flex-col gap-1.5">
              <div className="font-bold text-[12px] font-sans">Quick 3-step fix in Cloudflare Dashboard:</div>
              <div>1. Go to <strong>Cloudflare Dashboard → R2 → ignitext-pdfs → Settings</strong></div>
              <div>2. Scroll to <strong>CORS Policy</strong> → click <strong>Add CORS policy</strong></div>
              <div>3. Paste the configuration below and click <strong>Save</strong>:</div>
            </div>
            <div className="relative mb-3">
              <pre className="bg-[#1C1B17] text-[#C8E600] font-mono text-[10.5px] p-3 rounded-xl overflow-x-auto">
{`[
  {
    "AllowedOrigins": ["https://ignite-xt-topaz.vercel.app", "http://localhost:3000", "*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify([
                    {
                      "AllowedOrigins": ["https://ignite-xt-topaz.vercel.app", "http://localhost:3000", "*"],
                      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
                      "AllowedHeaders": ["*"],
                      "ExposeHeaders": ["ETag"],
                      "MaxAgeSeconds": 3600
                    }
                  ], null, 2));
                  alert('CORS JSON copied to clipboard! Paste it into Cloudflare Dashboard -> R2 -> ignitext-pdfs -> Settings -> CORS Policy.');
                }}
                className="absolute top-2 right-2 bg-[#C8E600] text-[#1C1B17] font-bold text-[10px] px-2.5 py-1 rounded-md border border-[#1C1B17] shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                Copy JSON
              </button>
            </div>
            <div className="text-[11px] text-[var(--ink-soft)] font-medium">
              💡 <strong>Instant Terminal Alternative:</strong> Run <code className="bg-[var(--paper)] px-1.5 py-0.5 rounded border border-[var(--rule)] font-mono font-bold">npm run upload -- &quot;path/to/notes.pdf&quot; &quot;{derivedShortCode || 'CIS'}&quot; notes 1</code> in your terminal to upload immediately without CORS.
            </div>
          </div>
        ) : error ? (
          <div className="bg-[var(--red-bg)] text-[var(--red)] p-3.5 rounded-xl border border-[var(--red)] text-[13px] font-bold mb-5 shadow-xs">
            {error}
          </div>
        ) : null}

        {/* Feature Banner */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[#D7E600]/25 shadow-[3px_3px_0_var(--ink)] mb-6 flex items-start gap-3">
          <SparklesIcon className="w-5 h-5 text-[var(--ink)] shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed text-[var(--ink)]">
            <span className="font-bold">Auto-Sequential Naming Enabled:</span> Files uploaded here are automatically given sequential names (e.g. <strong>CIS Unit-1-1</strong>, <strong>CIS Unit-1-2</strong>) and organized in R2 folders without messy raw filenames.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Subject Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              Subject
            </label>
            <select 
              required 
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="w-full bg-[var(--paper-card)] border-[2px] border-[var(--ink)] rounded-xl px-3.5 py-3 text-[13.5px] font-bold text-[var(--ink)] outline-none shadow-[2px_2px_0_var(--ink)]"
            >
              <option value="">Select a subject...</option>
              {subjects.map(s => {
                const sc = deriveSubjectShortCode(s.name, s.short_name);
                return (
                  <option key={s.id} value={s.id}>
                    [{sc}] {s.name} ({s.code || 'SUB'}) · Sem {s.semester}
                  </option>
                );
              })}
            </select>
            {derivedShortCode && (
              <p className="text-[11px] font-mono text-[var(--ink-soft)] mt-1.5 ml-1">
                Detected Acronym: <strong className="text-[var(--ink)] bg-[#D7E600] px-1.5 py-0.5 rounded border border-[var(--ink)]">{derivedShortCode}</strong>
              </p>
            )}
          </div>

          {/* Material Category */}
          <div>
            <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              Material Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'notes', label: 'Unit Notes' },
                { id: 'pyq', label: 'PYQ Papers' },
                { id: 'imp', label: 'Important Qs' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setMaterialType(cat.id as any)}
                  className={`p-3 rounded-xl border-[1.5px] font-bold text-[12px] transition-all cursor-pointer ${
                    materialType === cat.id
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-[2px_2px_0_var(--ink)]'
                      : 'border-[var(--rule-strong)] bg-[var(--paper-card)] text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit / Year Selection */}
          {materialType === 'notes' ? (
            <div>
              <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
                Target Unit
              </label>
              <select 
                required 
                value={unitOrYear}
                onChange={e => setUnitOrYear(e.target.value)}
                className="w-full bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-[var(--ink)] outline-none"
              >
                {Array.from({ length: selectedSubject?.total_units || 5 }).map((_, i) => (
                  <option key={i} value={`Unit ${i + 1}`}>Unit {i + 1}</option>
                ))}
              </select>
              {derivedUnitTitle && (
                <div className="bg-[#D7E600]/30 text-[var(--ink)] p-2.5 rounded-lg text-[11.5px] font-medium flex items-center gap-2 mt-2 border border-[var(--ink)]">
                  <CheckCircleIcon className="w-4 h-4 shrink-0" /> 
                  <span>Syllabus: <strong>{derivedUnitTitle}</strong></span>
                </div>
              )}
            </div>
          ) : materialType === 'pyq' ? (
            <div>
              <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
                Exam Year
              </label>
              <input 
                type="text" 
                required 
                placeholder="e.g. 2025"
                value={unitOrYear}
                onChange={e => setUnitOrYear(e.target.value)}
                className="w-full bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-[var(--ink)] outline-none"
              />
            </div>
          ) : null}

          {/* Multiple PDF File Dropzone */}
          <div>
            <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              Select One or Multiple PDF Files
            </label>
            <div className={`border-[2px] border-dashed ${files.length > 0 ? 'border-[var(--ink)] bg-[#D7E600]/15' : 'border-[var(--rule-strong)] bg-[var(--paper-card)]'} rounded-2xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-colors relative shadow-xs`}>
              <UploadCloudIcon className="w-8 h-8 mb-2 text-[var(--ink)]" />
              <div className="font-bold text-[13.5px] text-[var(--ink)] mb-0.5">
                {files.length > 0 ? `${files.length} PDF(s) Selected` : 'Tap to select one or multiple PDFs'}
              </div>
              <div className="text-[11px] font-mono text-[var(--ink-soft)]">
                Hold Shift/Ctrl or multiselect · Automatic sequential naming applied
              </div>
              <input 
                type="file" 
                accept="application/pdf" 
                multiple
                required={files.length === 0}
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer" 
              />
            </div>

            {/* Selected Files List Preview */}
            {files.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {files.map((f, idx) => {
                  const previewTitle = selectedSubject ? generateMaterialTitle({
                    shortCode: derivedShortCode || 'SUB',
                    category: materialType,
                    unitNumber: materialType === 'notes' ? (parseInt(unitOrYear.replace('Unit ', '')) || 1) : null,
                    seqNumber: idx + 1
                  }) : f.name;

                  return (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--rule-strong)] bg-[var(--paper-deep)] text-[12px]">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FilesIcon className="w-4 h-4 shrink-0 text-[var(--ink-soft)]" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[var(--ink)] flex items-center gap-2 truncate">
                            <span className="bg-[#C8E600] text-[#1C1B17] px-2 py-0.5 rounded font-mono text-[10.5px] font-black border border-[#1C1B17]">
                              {previewTitle}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--ink-soft)] truncate font-mono mt-0.5">
                            Raw file: {f.name} · {(f.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-[var(--ink-soft)] hover:text-red-600 p-1 rounded-lg transition-colors ml-2 shrink-0 cursor-pointer"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {status === 'uploading' && uploadProgress && (
            <div className="p-4 rounded-xl border border-[var(--ink)] bg-[var(--paper-card)] shadow-xs">
              <div className="flex justify-between text-[11px] font-bold text-[var(--ink)] mb-1.5">
                <span>Uploading {uploadProgress.current} of {uploadProgress.total}: <strong>{uploadProgress.title}</strong></span>
                <span className="font-mono">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-[var(--paper-deep)] h-2.5 rounded-full overflow-hidden border border-[var(--rule)]">
                <div 
                  className="bg-[var(--ink)] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={status === 'uploading' || files.length === 0 || !subjectId}
            className="w-full bg-[var(--ink)] text-[var(--paper)] font-bold text-[14px] py-3.5 rounded-xl border-[2px] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] hover:translate-y-[1px] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {status === 'uploading' ? (
              <>
                <Loader2Icon className="w-4 h-4 animate-spin text-[#D7E600]" />
                <span>Publishing {files.length} Materials...</span>
              </>
            ) : (
              <span>Publish {files.length > 0 ? `${files.length} Materials` : 'Material'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

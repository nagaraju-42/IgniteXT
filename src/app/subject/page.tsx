'use client';

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ChevronLeftIcon, 
  ChevronDownIcon, 
  FileTextIcon, 
  HelpCircleIcon, 
  Loader2Icon,
  DownloadIcon,
  FolderDownIcon,
  CheckCircle2Icon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OfflineButton } from "@/components/OfflineButton";
import { ReportButton } from "@/components/ReportButton";
import { getUnitColor } from "@/lib/colorUtils";
import { OfflineManager } from "@/lib/offlineManager";

const DEFAULT_R2_URL = 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev';

function extractSubjectId(searchParams: URLSearchParams | null): string | null {
  const fromParams = searchParams?.get('id');
  if (fromParams && fromParams.trim() && fromParams !== 'null' && fromParams !== 'undefined') {
    return fromParams.trim();
  }
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const fromSearch = urlParams.get('id');
    if (fromSearch && fromSearch.trim() && fromSearch !== 'null' && fromSearch !== 'undefined') {
      return fromSearch.trim();
    }
    if (window.location.hash && window.location.hash.includes('id=')) {
      const qIndex = window.location.hash.indexOf('?');
      if (qIndex !== -1) {
        const fromHash = new URLSearchParams(window.location.hash.substring(qIndex)).get('id');
        if (fromHash && fromHash.trim()) return fromHash.trim();
      }
    }
  }
  return null;
}

function SubjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [subjectId, setSubjectId] = useState<string | null>(() => extractSubjectId(searchParams));
  const [subject, setSubject] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [pyqs, setPyqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initChecked, setInitChecked] = useState(false);
  const [isPyqOpen, setIsPyqOpen] = useState(false);
  const [showFileSize, setShowFileSize] = useState(false);
  const [showDls, setShowDls] = useState(false);
  const [isDownloadingPack, setIsDownloadingPack] = useState(false);
  const [packProgress, setPackProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [isPackDownloaded, setIsPackDownloaded] = useState(false);

  // Check if all notes in this subject are already downloaded
  useEffect(() => {
    async function checkPackStatus() {
      const allFiles = [...notes, ...pyqs];
      if (allFiles.length === 0) {
        setIsPackDownloaded(false);
        return;
      }
      let allDownloaded = true;
      for (const item of allFiles) {
        if (item.file_url) {
          const fn = OfflineManager.getFileName(item.file_url);
          const isDownloaded = await OfflineManager.isFileDownloaded(fn);
          if (!isDownloaded) {
            allDownloaded = false;
            break;
          }
        }
      }
      setIsPackDownloaded(allDownloaded);
    }
    checkPackStatus();

    const handleSync = () => checkPackStatus();
    window.addEventListener('offline_files_changed', handleSync);
    return () => window.removeEventListener('offline_files_changed', handleSync);
  }, [notes, pyqs]);

  const handleDownloadPack = async () => {
    const allFiles = [...notes, ...pyqs].filter(f => f.file_url);
    if (allFiles.length === 0) return;

    setIsDownloadingPack(true);

    for (let i = 0; i < allFiles.length; i++) {
      const item = allFiles[i];
      const fn = OfflineManager.getFileName(item.file_url);
      setPackProgress({
        current: i + 1,
        total: allFiles.length,
        message: item.title || `File ${i + 1}`
      });

      const already = await OfflineManager.isFileDownloaded(fn);
      if (!already) {
        const fullUrl = item.file_url.startsWith('http') 
          ? item.file_url 
          : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${item.file_url}`;
        await OfflineManager.downloadFile(fullUrl, fn);
      }
      OfflineManager.saveMetadata(fn, item.title, item.file_size_kb, subject?.name);
    }

    setIsDownloadingPack(false);
    setIsPackDownloaded(true);
    setPackProgress(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_files_changed', { detail: { action: 'pack_saved' } }));
    }
  };

  const supabase = createClient();

  useEffect(() => {
    try {
      const fsVal = localStorage.getItem('semkit_show_file_size');
      if (fsVal !== null) setShowFileSize(fsVal === 'true');
      const dlVal = localStorage.getItem('semkit_show_download_counts');
      if (dlVal !== null) setShowDls(dlVal === 'true');
    } catch(e) {}

    async function loadDisplaySettings() {
      try {
        const { data } = await supabase.from('platform_settings').select('key, value').in('key', ['show_file_size', 'show_download_counts']);
        if (data) {
          const fsRow = data.find((r: any) => r.key === 'show_file_size');
          const dlRow = data.find((r: any) => r.key === 'show_download_counts');
          if (fsRow) {
            const val = fsRow.value === 'true';
            setShowFileSize(val);
            try { localStorage.setItem('semkit_show_file_size', String(val)); } catch(e) {}
          }
          if (dlRow) {
            const val = dlRow.value === 'true';
            setShowDls(val);
            try { localStorage.setItem('semkit_show_download_counts', String(val)); } catch(e) {}
          }
        }
      } catch(e) {}
    }
    loadDisplaySettings();
  }, [supabase]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  // Resolve ID with fallback for client-side hydration
  useEffect(() => {
    const sid = extractSubjectId(searchParams);
    if (sid) {
      setSubjectId(sid);
      setInitChecked(true);
    } else {
      const timer = setTimeout(() => {
        const retrySid = extractSubjectId(searchParams);
        if (retrySid) {
          setSubjectId(retrySid);
        }
        setInitChecked(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Load subject & content once subjectId is available
  useEffect(() => {
    if (!subjectId) {
      if (initChecked) setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        // 1. Fetch subject details
        let subData: any = null;
        const { data: joinedData } = await supabase
          .from('subjects')
          .select('*, regulations(code), branches(code)')
          .eq('id', subjectId)
          .maybeSingle();

        if (joinedData) {
          subData = joinedData;
        } else {
          const { data: rawSub } = await supabase
            .from('subjects')
            .select('*')
            .eq('id', subjectId)
            .maybeSingle();
          subData = rawSub;
        }

        if (!isMounted) return;
        setSubject(subData);

        if (subData) {
          // 2. Fetch content items directly from content_items table
          const { data: contentData } = await supabase
            .from('content_items')
            .select('*')
            .eq('subject_id', subjectId)
            .eq('status', 'published')
            .order('unit_number', { ascending: true });

          if (!isMounted) return;

          if (contentData) {
            const rawNotes = contentData.filter((c: any) => c.type === 'note');
            // Strictly eliminate confusing duplicate titles by appending Part 1, Part 2, etc.
            const titleCounts: Record<string, number> = {};
            rawNotes.forEach((n: any) => {
              titleCounts[n.title] = (titleCounts[n.title] || 0) + 1;
            });
            const titleOccurrences: Record<string, number> = {};
            const cleanNotes = rawNotes.map((n: any) => {
              if (titleCounts[n.title] > 1) {
                titleOccurrences[n.title] = (titleOccurrences[n.title] || 0) + 1;
                return {
                  ...n,
                  displayTitle: `${n.title} (Part ${titleOccurrences[n.title]})`
                };
              }
              return {
                ...n,
                displayTitle: n.title
              };
            });
            setNotes(cleanNotes);
            setPyqs(contentData.filter((c: any) => c.type === 'pyq').sort((a: any, b: any) => (b.exam_year || 0) - (a.exam_year || 0)));
          }
        }
      } catch (err) {
        console.error('Error loading subject data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [subjectId, initChecked]);

  const handleOpenFile = async (fileUrl: string, title: string) => {
    const filename = OfflineManager.getFileName(fileUrl);
    const isOffline = await OfflineManager.isFileDownloaded(filename);
    const isPdf = filename.toLowerCase().endsWith('.pdf');

    if (isOffline && isPdf) {
      router.push(`/read?file=${encodeURIComponent(filename)}&title=${encodeURIComponent(title)}`);
      return;
    }

    const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL;
    let fullUrl = fileUrl.startsWith('http') ? fileUrl : `${r2Base}/${fileUrl}`;
    fullUrl = encodeURI(fullUrl);
    window.open(fullUrl, '_blank');
  };

  if (loading || (!subject && !initChecked)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[var(--paper)]">
        <Loader2Icon className="w-6 h-6 animate-spin text-[var(--ink)] mb-2" />
        <p className="text-[12px] font-semibold text-[var(--ink-soft)]">Loading subject materials...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="flex flex-col h-full bg-[var(--paper)]">
        <div className="px-[18px] py-4 border-b border-[var(--rule)] bg-[var(--paper-card)] flex items-center gap-3">
          <button
            onClick={handleBack}
            type="button"
            aria-label="Back"
            className="p-1.5 -ml-1.5 rounded-full hover:bg-[var(--rule)] transition-colors active:scale-95 text-[var(--ink)] cursor-pointer"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="font-bold text-[15px] text-[var(--ink)]">Subject</span>
        </div>
        <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="font-bold text-[18px] text-[var(--ink)] mb-2">Subject not found</h1>
          <p className="text-[12px] text-[var(--ink-soft)] mb-5 max-w-[260px]">
            The requested subject could not be located or may have been updated.
          </p>
          <button
            onClick={handleBack}
            type="button"
            className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[12px] px-5 py-2.5 rounded-lg active:scale-95 transition-all inline-flex items-center gap-1.5"
          >
            <ChevronLeftIcon className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const totalUnits = subject.total_units || 5;
  const groups = Array.from({ length: totalUnits }, (_, i) => i + 1);

  // Group notes into units and general/extra materials
  const generalNotes = notes.filter((n: any) => !n.unit_number || n.unit_number < 1 || n.unit_number > totalUnits);

  return (
    <div className="h-full flex flex-col bg-[var(--paper)]">
      {/* Header */}
      <div className="px-[18px] py-4 border-b border-[var(--rule)] bg-[var(--paper-card)] flex items-start gap-3 sticky top-0 z-10 shrink-0">
        <button
          onClick={handleBack}
          type="button"
          aria-label="Back"
          className="mt-1 shrink-0 p-1.5 -ml-1.5 rounded-full hover:bg-[var(--rule)] transition-colors active:scale-95 text-[var(--ink)] cursor-pointer"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-[var(--ink-soft)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            {subject.regulations?.code && <span>{subject.regulations.code}</span>}
            {subject.regulations?.code && subject.branches?.code && (
              <span className="w-1 h-1 rounded-full bg-[var(--ink-faint)]"></span>
            )}
            {subject.branches?.code && <span>{subject.branches.code}</span>}
            <span className="w-1 h-1 rounded-full bg-[var(--ink-faint)]"></span>
            <span>Sem {subject.semester}</span>
          </div>
          <h1 className="font-bold text-[19px] leading-tight text-[var(--ink)]">{subject.name}</h1>
          {subject.code && (
            <div className="mt-1.5 inline-block font-mono text-[10px] bg-[var(--rule)] px-2 py-0.5 rounded text-[var(--ink-soft)] font-semibold">
              {subject.code}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-5">
        
        {/* 1-Click Offline Subject Pack */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[#D7E600]/20 mb-6 shadow-[3px_3px_0_var(--ink)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <FolderDownIcon className="w-4 h-4 text-[var(--ink)]" />
                <span className="font-bold text-[13.5px] text-[var(--ink)]">
                  1-Click Offline Subject Pack
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--ink-soft)] leading-snug">
                Download all {notes.length + pyqs.length} notes & PYQs to study offline without internet
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadPack}
              disabled={isDownloadingPack || (notes.length === 0 && pyqs.length === 0)}
              className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[12px] px-3.5 py-2.5 rounded-xl shadow-sm hover:translate-y-[1px] active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isDownloadingPack ? (
                <>
                  <Loader2Icon className="w-4 h-4 animate-spin text-[#D7E600]" />
                  <span>{packProgress?.current || 1}/{packProgress?.total || 1}</span>
                </>
              ) : isPackDownloaded ? (
                <>
                  <CheckCircle2Icon className="w-4 h-4 text-[#D7E600]" />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4" />
                  <span>Download All</span>
                </>
              )}
            </button>
          </div>
          {isDownloadingPack && packProgress && (
            <div className="mt-3 pt-2.5 border-t border-[var(--rule-strong)]">
              <div className="flex justify-between text-[10.5px] font-mono text-[var(--ink-soft)] mb-1">
                <span className="truncate pr-2">{packProgress.message}</span>
                <span className="shrink-0">{Math.round((packProgress.current / packProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-[var(--paper)] h-2 rounded-full overflow-hidden border border-[var(--rule)]">
                <div 
                  className="bg-[var(--ink)] h-full transition-all duration-300"
                  style={{ width: `${(packProgress.current / packProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Unit Notes Section */}
        <h2 className="font-semibold text-[13px] text-[var(--ink-soft)] uppercase tracking-wide mb-3 flex items-center gap-2">
          <FileTextIcon className="w-4 h-4 opacity-70" /> Lecture Notes
        </h2>
        
        <div className="flex flex-col gap-4 mb-8">
          {groups.map(unitNum => {
            const unitNotes = notes.filter(n => n.unit_number === unitNum);
            
            return (
              <div key={unitNum} className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`${getUnitColor(unitNum)} px-2 py-0.5 rounded-[4px] text-[10px] font-extrabold uppercase tracking-wider`}>
                    Unit {unitNum}
                  </span>
                  <div className="h-[1px] flex-1 bg-[var(--rule)]"></div>
                </div>
                
                {unitNotes.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {unitNotes.map(note => (
                      <div key={note.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--paper-deep)] border border-[var(--rule-strong)] flex items-center justify-center shrink-0 shadow-sm text-[var(--ink)]">
                          <FileTextIcon className="w-4 h-4" />
                        </div>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleOpenFile(note.file_url, `${subject.name} - ${note.title}`)}
                        >
                          <div className="font-semibold text-[13px] leading-snug break-words text-[var(--ink)]">{(note.displayTitle || note.title).replace(/^null\s/, '')}</div>
                          {(showFileSize || showDls) && (
                            <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-1 flex gap-2">
                              {showFileSize && note.file_size_kb && (
                                <span>{(note.file_size_kb / 1024).toFixed(1)} MB</span>
                              )}
                              {showDls && (
                                <span>{note.download_count || 0} DLs</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-center shrink-0">
                          <OfflineButton contentId={note.id} fileUrl={note.file_url} title={note.title} sizeKb={note.file_size_kb} subjectName={subject?.name} />
                          <ReportButton contentId={note.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-[1.5px] border-dashed border-[var(--rule)] rounded-lg p-3 bg-[var(--paper-deep)]/50 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium text-[var(--ink-soft)]">No PDFs uploaded yet</span>
                      <span className="text-[10px] text-[var(--ink-faint)] font-mono uppercase tracking-wider">Coming Soon</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* General / Additional Notes if any */}
          {generalNotes.length > 0 && (
            <div className="flex flex-col mt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-[4px] text-[10px] font-extrabold uppercase tracking-wider">
                  Additional Materials
                </span>
                <div className="h-[1px] flex-1 bg-[var(--rule)]"></div>
              </div>
              <div className="flex flex-col gap-2.5">
                {generalNotes.map(note => (
                  <div key={note.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--paper-deep)] border border-[var(--rule-strong)] flex items-center justify-center shrink-0 shadow-sm text-[var(--ink)]">
                      <FileTextIcon className="w-4 h-4" />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleOpenFile(note.file_url, `${subject.name} - ${note.title}`)}
                    >
                      <div className="font-semibold text-[13px] leading-snug break-words text-[var(--ink)]">{note.title.replace(/^null\s/, '')}</div>
                      {(showFileSize || showDls) && (
                        <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-1 flex gap-2">
                          {showFileSize && note.file_size_kb && (
                            <span>{(note.file_size_kb / 1024).toFixed(1)} MB</span>
                          )}
                          {showDls && (
                            <span>{note.download_count || 0} DLs</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-center shrink-0">
                      <OfflineButton contentId={note.id} fileUrl={note.file_url} title={note.title} sizeKb={note.file_size_kb} subjectName={subject?.name} />
                      <ReportButton contentId={note.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nested PYQ Box Component */}
        <div className="mt-4 mb-8 border-[2px] border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] overflow-hidden transition-all">
          {/* Clickable Header Box */}
          <button
            type="button"
            onClick={() => setIsPyqOpen(prev => !prev)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--paper-deep)] transition-colors cursor-pointer select-none"
            aria-expanded={isPyqOpen}
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-[#D7E600] border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center shrink-0">
                <HelpCircleIcon className="w-5 h-5 text-[var(--ink)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-[15px] text-[var(--ink)] leading-tight">
                    Previous Year Questions (PYQs)
                  </h2>
                  <span className="font-mono text-[10px] font-bold bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-full">
                    {pyqs.length}
                  </span>
                </div>
                <p className="text-[11.5px] text-[var(--ink-soft)] mt-0.5 font-medium truncate">
                  {isPyqOpen ? "Tap to close papers" : "Tap to open and view PYQ papers"}
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-[var(--paper)] border border-[var(--rule-strong)] flex items-center justify-center shrink-0 text-[var(--ink)]">
              <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isPyqOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Nested Papers List: Opens on click */}
          {isPyqOpen && (
            <div className="p-3.5 pt-2 border-t-[1.5px] border-[var(--rule-strong)] bg-[var(--paper)] flex flex-col gap-2.5 animate-in fade-in duration-200">
              {pyqs.length > 0 ? (
                pyqs.map(pyq => (
                  <div key={pyq.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper-card)] flex justify-between items-center gap-3 hover:border-[var(--ink)] transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[var(--paper-deep)] border border-[var(--rule-strong)] flex items-center justify-center shrink-0 shadow-sm text-[var(--ink)]">
                      <FileTextIcon className="w-4 h-4" />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleOpenFile(pyq.file_url, `${subject.name} - ${pyq.title}`)}
                    >
                      <div className="font-semibold text-[13px] leading-snug break-words text-[var(--ink)]">{pyq.title.replace(/^null\s/, '')}</div>
                      <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-1 uppercase flex gap-1.5 items-center flex-wrap">
                        <span className="bg-[var(--ink)] text-[var(--paper)] px-1.5 py-0.5 rounded-[4px] font-extrabold">{pyq.exam_type || 'EXAM'} {pyq.exam_year || ''}</span>
                        {showFileSize && pyq.file_size_kb && (
                          <span>• {(pyq.file_size_kb / 1024).toFixed(1)} MB</span>
                        )}
                        {showDls && (
                          <span>• {pyq.download_count || 0} DLs</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-center shrink-0">
                      <OfflineButton contentId={pyq.id} fileUrl={pyq.file_url} title={pyq.title} sizeKb={pyq.file_size_kb} subjectName={subject?.name} />
                      <ReportButton contentId={pyq.id} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-4 bg-[var(--paper-deep)]/40 flex justify-between items-center">
                  <div className="flex flex-col text-left">
                    <span className="text-[12px] font-medium text-[var(--ink-soft)]">No past papers available yet</span>
                    <span className="text-[10px] text-[var(--ink-faint)] font-mono uppercase tracking-wider">Coming Soon</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SubjectPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center bg-[var(--paper)] h-full">Loading...</div>}>
      <SubjectContent />
    </Suspense>
  );
}

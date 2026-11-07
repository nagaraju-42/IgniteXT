'use client';

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, FileTextIcon, HelpCircleIcon, Loader2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OfflineButton } from "@/components/OfflineButton";
import { ReportButton } from "@/components/ReportButton";
import { getUnitColor } from "@/lib/colorUtils";
import { FileTypeIcon } from "@/components/FileTypeIcon";
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

  const supabase = createClient();

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
            setNotes(contentData.filter((c: any) => c.type === 'note'));
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
                        <FileTypeIcon filename={note.file_url} className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm" />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleOpenFile(note.file_url, `${subject.name} - ${note.title}`)}
                        >
                          <div className="font-semibold text-[13.5px] truncate">{note.title.replace(/^null\s/, '')}</div>
                          <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 flex gap-2">
                            <span>{note.file_size_kb ? `${(note.file_size_kb / 1024).toFixed(1)} MB` : 'PDF'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-center shrink-0">
                          <OfflineButton contentId={note.id} fileUrl={note.file_url} title={`${subject?.name || 'Subject'} - ${note.title}`} />
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
                    <FileTypeIcon filename={note.file_url} className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm" />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleOpenFile(note.file_url, `${subject.name} - ${note.title}`)}
                    >
                      <div className="font-semibold text-[13.5px] truncate">{note.title.replace(/^null\s/, '')}</div>
                      <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 flex gap-2">
                        <span>{note.file_size_kb ? `${(note.file_size_kb / 1024).toFixed(1)} MB` : 'PDF'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-center shrink-0">
                      <OfflineButton contentId={note.id} fileUrl={note.file_url} title={`${subject?.name || 'Subject'} - ${note.title}`} />
                      <ReportButton contentId={note.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PYQs Section */}
        <h2 className="font-semibold text-[13px] text-[var(--ink-soft)] uppercase tracking-wide mb-3 flex items-center gap-2 mt-4">
          <HelpCircleIcon className="w-4 h-4 opacity-70" /> Previous Year Questions
        </h2>

        {pyqs.length > 0 ? (
          <div className="flex flex-col gap-2.5 mb-8">
            {pyqs.map(pyq => (
              <div key={pyq.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
                <FileTypeIcon filename={pyq.file_url} className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm" />
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleOpenFile(pyq.file_url, `${subject.name} - ${pyq.title}`)}
                >
                  <div className="font-semibold text-[13.5px] truncate">{pyq.title.replace(/^null\s/, '')}</div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 uppercase flex gap-1.5 items-center">
                    <span className="bg-[var(--ink)] text-[var(--paper)] px-1.5 py-0.5 rounded-[4px] font-extrabold">{pyq.exam_type || 'EXAM'} {pyq.exam_year || ''}</span>
                    <span>• {pyq.file_size_kb ? `${(pyq.file_size_kb / 1024).toFixed(1)} MB` : 'PDF'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-center shrink-0">
                  <OfflineButton contentId={pyq.id} fileUrl={pyq.file_url} title={`${subject?.name || 'Subject'} - ${pyq.title}`} />
                  <ReportButton contentId={pyq.id} />
                </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-4 bg-[var(--paper)] flex justify-between items-center mb-8">
             <div className="flex flex-col text-left">
               <span className="text-[12.5px] font-medium text-[var(--ink-soft)]">No past papers available yet</span>
             </div>
           </div>
        )}

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

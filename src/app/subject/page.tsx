'use client';

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ChevronLeftIcon, FileTextIcon, HelpCircleIcon, Loader2Icon } from "lucide-react";
import { getContentBySubject } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { OfflineButton } from "@/components/OfflineButton";
import { ReportButton } from "@/components/ReportButton";
import { getUnitColor } from "@/lib/colorUtils";
import { FileTypeIcon } from "@/components/FileTypeIcon";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SubjectContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  const [subject, setSubject] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [pyqs, setPyqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadSubject() {
      const { data: subjectData } = await supabase
        .from('subjects')
        .select('*, regulations(code), branches(code)')
        .eq('id', id)
        .single();
      
      setSubject(subjectData);

      if (subjectData) {
        const content = await getContentBySubject(id);
        setNotes(content.filter(c => c.type === 'note').sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0)));
        setPyqs(content.filter(c => c.type === 'pyq').sort((a, b) => (b.exam_year || 0) - (a.exam_year || 0)));
      }
      setLoading(false);
    }
    loadSubject();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[var(--paper)]">
        <Loader2Icon className="w-6 h-6 animate-spin text-[var(--ink)] mb-2" />
        <p className="text-[12px] font-semibold text-[var(--ink-soft)]">Loading subject...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="p-8 text-center bg-[var(--paper)] h-full">
        <h1 className="font-bold text-xl mb-2">Subject not found</h1>
        <Link href="/browse" className="text-[var(--hl-ink)] underline">Go back to Browse</Link>
      </div>
    );
  }

  const groups = Array.from({ length: subject.total_units || 5 }, (_, i) => i + 1);

  return (
    <div className="h-full flex flex-col bg-[var(--paper)]">
      {/* Header */}
      <div className="px-[18px] py-4 border-b border-[var(--rule)] bg-[var(--paper-card)] flex items-start gap-3 sticky top-0 z-10">
        <Link href="/browse" className="mt-1 shrink-0 p-1.5 -ml-1.5 rounded-full hover:bg-[var(--rule)] transition-colors active:scale-95">
          <ChevronLeftIcon className="w-5 h-5 text-[var(--ink)]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-[var(--ink-soft)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span>{subject.regulations?.code}</span>
            <span className="w-1 h-1 rounded-full bg-[var(--ink-faint)]"></span>
            <span>{subject.branches?.code}</span>
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
                        <div className="flex-1 min-w-0" onClick={() => {
                          let fullUrl = note.file_url.startsWith('http') ? note.file_url : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${note.file_url}`;
                          fullUrl = encodeURI(fullUrl);
                          window.open(fullUrl, '_blank');
                        }} style={{cursor: 'pointer'}}>
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
                <div className="flex-1 min-w-0" onClick={() => {
                  let fullUrl = pyq.file_url.startsWith('http') ? pyq.file_url : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${pyq.file_url}`;
                  fullUrl = encodeURI(fullUrl);
                  window.open(fullUrl, '_blank');
                }} style={{cursor: 'pointer'}}>
                  <div className="font-semibold text-[13.5px] truncate">{pyq.title.replace(/^null\s/, '')}</div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 uppercase flex gap-1.5 items-center">
                    <span className="bg-[var(--ink)] text-[var(--paper)] px-1.5 py-0.5 rounded-[4px] font-extrabold">{pyq.exam_type} {pyq.exam_year}</span>
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

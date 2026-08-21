'use client';

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ChevronLeftIcon, FileTextIcon, HelpCircleIcon, Loader2Icon } from "lucide-react";
import { getContentBySubject } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { OfflineButton } from "@/components/OfflineButton";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SubjectContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  const [subject, setSubject] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [pyqs, setPyqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubject() {
      const supabase = createClient();
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

  return (
    <div className="flex flex-col h-full bg-[var(--paper-card)]">
      {/* Header */}
      <div className="px-[18px] pt-4 pb-4 border-b border-[var(--rule)] bg-[var(--paper)]">
        <Link href="/browse" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-soft)] mb-3 hover:text-[var(--ink)]">
          <ChevronLeftIcon className="w-4 h-4" /> Back to Browse
        </Link>
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="font-bold text-[20px] leading-tight mb-1">{subject.name}</h1>
            <div className="font-mono text-[11px] text-[var(--ink-soft)] flex gap-1.5 items-center">
              <span className="bg-[var(--paper-deep)] px-1.5 py-0.5 rounded">{subject.code}</span>
              <span>·</span>
              <span>{subject.regulations?.code}</span>
              <span>·</span>
              <span>{subject.branches?.code}</span>
              <span>·</span>
              <span>Sem {Math.ceil(subject.semester/2)}-{subject.semester%2===0?2:1}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-[18px] py-6 flex-1 overflow-y-auto">
        
        {/* Notes Section */}
        <h2 className="font-bold text-[16px] mb-3 flex items-center gap-2">
          <FileTextIcon className="w-4 h-4 text-[var(--ink-soft)]" /> Unit Notes
        </h2>
        
        {notes.length > 0 ? (
          <div className="flex flex-col gap-2.5 mb-8">
            {notes.map(note => (
              <div key={note.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px] truncate">Unit {note.unit_number}: {note.unit_title || note.title}</div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 truncate">
                    {note.file_size_kb ? `${(note.file_size_kb / 1024).toFixed(1)} MB` : 'PDF'} · By Admin
                  </div>
                </div>
                <OfflineButton contentId={note.id} fileUrl={note.file_url} title={note.title} />
              </div>
            ))}
          </div>
        ) : (
           <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-4 bg-[var(--paper)] text-center mb-8">
             <p className="text-[12.5px] font-medium text-[var(--ink-soft)]">No notes available yet</p>
           </div>
        )}

        {/* PYQs Section */}
        <h2 className="font-bold text-[16px] mb-3 flex items-center gap-2">
          <HelpCircleIcon className="w-4 h-4 text-[var(--ink-soft)]" /> Previous Year Papers
        </h2>

        {pyqs.length > 0 ? (
          <div className="flex flex-col gap-2.5 mb-8">
            {pyqs.map(pyq => (
              <div key={pyq.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px] truncate">{pyq.title}</div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 uppercase">
                    {pyq.exam_type} · {pyq.exam_year}
                  </div>
                </div>
                <OfflineButton contentId={pyq.id} fileUrl={pyq.file_url} title={pyq.title} />
              </div>
            ))}
          </div>
        ) : (
           <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-4 bg-[var(--paper)] text-center mb-8">
             <p className="text-[12.5px] font-medium text-[var(--ink-soft)]">No past papers available yet</p>
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

'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeftIcon, Loader2Icon, BookOpenIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const WebPDFReader = dynamic(() => import('@/components/web/WebPDFReader'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#1B1915] text-[var(--paper)] gap-3">
      <Loader2Icon className="w-8 h-8 animate-spin text-[#D7E600]" />
      <p className="text-[13px] font-bold">Loading Online PDF Reader...</p>
    </div>
  ),
});

export function WebRead() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const file = searchParams.get('file') || '';
  const title = searchParams.get('title') || 'Study Notes';
  const subjectId = searchParams.get('subjectId') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [subjectName, setSubjectName] = useState<string>('');
  const [siblingDocs, setSiblingDocs] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;

    async function loadSubjectPlaylist() {
      const [{ data: sub }, { data: items }] = await Promise.all([
        supabase.from('subjects').select('name').eq('id', subjectId).maybeSingle(),
        supabase.from('content_items').select('*').eq('subject_id', subjectId).eq('status', 'published'),
      ]);

      if (cancelled) return;
      if (sub?.name) setSubjectName(sub.name);
      if (items) {
        const sorted = [...items].sort((a, b) => {
          if (a.type !== b.type) return a.type === 'note' ? -1 : 1;
          const uDiff = (a.unit_number || 99) - (b.unit_number || 99);
          if (uDiff !== 0) return uDiff;
          return (a.title || '').localeCompare(b.title || '');
        });
        setSiblingDocs(sorted);
        const idx = sorted.findIndex((d) => d.file_url === file || d.title === title);
        setActiveIndex(idx);
      }
    }

    loadSubjectPlaylist();
    return () => {
      cancelled = true;
    };
  }, [subjectId, file, title]);

  const navigateToSibling = (doc: any) => {
    if (!doc?.file_url) return;
    router.push(
      `/read?file=${encodeURIComponent(doc.file_url)}&title=${encodeURIComponent(
        doc.title || 'Notes'
      )}&subjectId=${encodeURIComponent(subjectId)}`
    );
  };

  if (!file) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 border-2 border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] text-center shadow-[4px_4px_0_var(--ink)]">
        <BookOpenIcon className="w-10 h-10 mx-auto mb-3 text-[var(--ink)]" />
        <h1 className="font-display font-black text-[26px] mb-1">No Document Specified</h1>
        <p className="text-[13px] text-[var(--ink-soft)] mb-5">
          Pick any subject from the dashboard to open and preview its PDF notes online.
        </p>
        <Link href="/" className="btn btn-p inline-flex">
          <ChevronLeftIcon className="w-4 h-4" /> Back to Exam Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col p-2 sm:p-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <button
          type="button"
          onClick={() => (subjectId ? router.push(`/subject?id=${subjectId}`) : router.back())}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink)] hover:underline cursor-pointer"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span>{subjectName ? `Back to ${subjectName}` : 'Back'}</span>
        </button>

        {subjectId && (
          <Link
            href={`/subject?id=${subjectId}`}
            className="font-mono text-[11px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] underline"
          >
            View All Units & PYQs
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <WebPDFReader
          fileUrl={file}
          title={title}
          subjectId={subjectId}
          subjectName={subjectName}
          initialPage={initialPage}
          hasPrevDoc={activeIndex > 0}
          hasNextDoc={activeIndex >= 0 && activeIndex < siblingDocs.length - 1}
          onPrevDoc={() => activeIndex > 0 && navigateToSibling(siblingDocs[activeIndex - 1])}
          onNextDoc={() =>
            activeIndex >= 0 &&
            activeIndex < siblingDocs.length - 1 &&
            navigateToSibling(siblingDocs[activeIndex + 1])
          }
        />
      </div>
    </div>
  );
}

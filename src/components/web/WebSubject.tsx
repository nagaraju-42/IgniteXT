'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeftIcon,
  ChevronDownIcon,
  FileTextIcon,
  Loader2Icon,
  EyeIcon,
  DownloadIcon,
  BookmarkIcon,
  Share2Icon,
  CheckIcon,
  ClockIcon,
  FolderIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUnitColor } from '@/lib/colorUtils';
import { deriveSubjectShortCode } from '@/lib/subjectNaming';
import { DEFAULT_EXAM_TIMETABLE } from '@/lib/defaultExamTimetable';
import { fetchSyncedExamTimetable, getSubjectExamStatus } from '@/lib/examCountdown';
import { downloadWebPdf } from '@/lib/pdfUrl';
import { isBookmarked, toggleWebBookmark } from '@/lib/bookmarks';

const WebPDFReader = dynamic(() => import('@/components/web/WebPDFReader'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl border-2 border-[var(--ink)] bg-[#1B1915] flex flex-col items-center justify-center gap-3 text-center p-8">
      <Loader2Icon className="w-8 h-8 animate-spin text-[#D7E600]" />
      <p className="text-[13px] font-bold text-[var(--paper)]">Initializing PDF Auto-Preview...</p>
    </div>
  ),
});

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
  }
  return null;
}

export function WebSubject() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [subjectId, setSubjectId] = useState<string | null>(() => extractSubjectId(searchParams));
  const [subject, setSubject] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [pyqs, setPyqs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [examTimetable, setExamTimetable] = useState<any>(DEFAULT_EXAM_TIMETABLE);
  const [isPyqOpen, setIsPyqOpen] = useState<boolean>(false);

  // Selected document for desktop auto-preview pane
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bookmarkTrigger, setBookmarkTrigger] = useState<number>(0);

  // Track viewport size cleanly so mobile browsers never stream desktop preview in background
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Re-sync subjectId when query params change
  useEffect(() => {
    const resolved = extractSubjectId(searchParams);
    if (resolved && resolved !== subjectId) {
      setSubjectId(resolved);
    }
  }, [searchParams, subjectId]);

  useEffect(() => {
    fetchSyncedExamTimetable(supabase).then(setExamTimetable);
  }, []);

  useEffect(() => {
    const syncBm = () => setBookmarkTrigger((x) => x + 1);
    window.addEventListener('semkit_web_bookmarks_changed', syncBm);
    return () => window.removeEventListener('semkit_web_bookmarks_changed', syncBm);
  }, []);

  // Load subject + published materials
  useEffect(() => {
    if (!subjectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchSubjectAndContent() {
      setLoading(true);
      try {
        const [{ data: subData }, { data: contentData }] = await Promise.all([
          supabase.from('subjects').select('*').eq('id', subjectId).single(),
          supabase
            .from('content_items')
            .select('*')
            .eq('subject_id', subjectId)
            .eq('status', 'published'),
        ]);

        if (cancelled) return;
        setSubject(subData || null);

        if (contentData) {
          const rawNotes = contentData
            .filter((c: any) => c.type !== 'pyq')
            .sort((a: any, b: any) => {
              const unitDiff = (a.unit_number || 99) - (b.unit_number || 99);
              if (unitDiff !== 0) return unitDiff;
              return (a.title || '').localeCompare(b.title || '');
            });

          const rawPyqs = contentData
            .filter((c: any) => c.type === 'pyq')
            .sort((a: any, b: any) => (b.exam_year || 0) - (a.exam_year || 0) || (a.title || '').localeCompare(b.title || ''));

          setNotes(rawNotes);
          setPyqs(rawPyqs);

          // Auto-select doc from ?doc= param OR first available note/PYQ for instant auto-preview
          const docParam = searchParams?.get('doc');
          const allOrdered = [...rawNotes, ...rawPyqs];
          let initialDoc = allOrdered[0] || null;
          if (docParam) {
            const found = allOrdered.find(
              (item) => item.id === docParam || item.file_url === docParam
            );
            if (found) {
              initialDoc = found;
              if (found.type === 'pyq') setIsPyqOpen(true);
            }
          }
          setSelectedDoc(initialDoc);
        }
      } catch {
        if (!cancelled) setSubject(null);
      }
      if (!cancelled) setLoading(false);
    }

    fetchSubjectAndContent();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const shortCode = useMemo(() => {
    return subject ? deriveSubjectShortCode(subject.name, subject.code) : 'SUB';
  }, [subject]);

  // Preserve authentic clean migrated titles (e.g., "CIS Unit-3-1 (Units 3, 4)", "WT IMP-1 (Mid Topics)")
  const formatDisplayTitle = (item: any, fallbackUnit?: number, fallbackSeq?: number) => {
    const cleanRaw = (item.title || '').replace(/^null\s+/i, '').trim();
    if (cleanRaw && cleanRaw.length > 2) return cleanRaw;
    if (item.type === 'pyq') return `${shortCode} PYQ-${fallbackSeq || 1}`;
    return `${shortCode} Unit-${fallbackUnit || item.unit_number || 1}-${fallbackSeq || 1}`;
  };

  // Ordered playlist of all documents so students can step Prev / Next seamlessly
  const orderedDocs = useMemo(() => {
    return [...notes, ...pyqs];
  }, [notes, pyqs]);

  const activeDocIndex = useMemo(() => {
    if (!selectedDoc) return -1;
    return orderedDocs.findIndex((d) => d.id === selectedDoc.id && d.unit_number === selectedDoc.unit_number);
  }, [orderedDocs, selectedDoc]);

  const examCountdown = useMemo(() => {
    if (!subject) return null;
    return getSubjectExamStatus(subject, examTimetable);
  }, [subject, examTimetable]);

  const handleSelectDoc = (doc: any) => {
    if (!doc || !doc.file_url) return;

    if (isDesktop) {
      setSelectedDoc(doc);
      if (doc.type === 'pyq') setIsPyqOpen(true);
      // Update URL smoothly so current preview can be bookmarked/shared without reload
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('doc', doc.id);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // Ignore history errors
      }
    } else {
      // Mobile Web: open full responsive reader immediately (no forced download!)
      const title = formatDisplayTitle(doc);
      router.push(
        `/read?file=${encodeURIComponent(doc.file_url)}&title=${encodeURIComponent(title)}&subjectId=${encodeURIComponent(subject?.id || '')}`
      );
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard fallback unavailable
    }
  };

  const handleExplicitDownload = async (e: React.MouseEvent, item: any, title: string) => {
    e.stopPropagation();
    if (!item.file_url) return;
    setDownloadingId(item.id);
    try {
      await downloadWebPdf(item.file_url, title);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleBookmark = (e: React.MouseEvent, item: any, title: string) => {
    e.stopPropagation();
    toggleWebBookmark({
      id: item.id,
      fileUrl: item.file_url,
      title,
      subjectId: subject?.id || '',
      subjectName: subject?.name || '',
      shortCode,
      type: item.type === 'pyq' ? 'pyq' : 'note',
      unitNumber: item.unit_number,
      fileSizeKb: item.file_size_kb,
    });
    setBookmarkTrigger((x) => x + 1);
  };

  const scrollToUnitSection = (unitKey: string) => {
    const el = document.getElementById(`web-unit-${unitKey}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)]" />
        <p className="text-[13px] font-bold text-[var(--ink-soft)]">Loading subject study workspace...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 border-2 border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] text-center shadow-[4px_4px_0_var(--ink)]">
        <h1 className="font-display font-black text-[28px] mb-2">Subject Not Found</h1>
        <p className="text-[13px] text-[var(--ink-soft)] mb-5">
          We could not locate this subject. It may have been moved or removed.
        </p>
        <Link href="/" className="btn btn-p inline-flex">
          <ChevronLeftIcon className="w-4 h-4" /> Back to Exam Hub
        </Link>
      </div>
    );
  }

  const totalUnits = subject.total_units || 5;
  const units = Array.from({ length: totalUnits }, (_, i) => i + 1);

  return (
    <div className="flex flex-col flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 pt-4 pb-6">
      {/* Top Subject Breadcrumb & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-card)] hover:bg-[#D7E600] flex items-center justify-center text-[var(--ink)] shadow-[2px_2px_0_var(--ink)] transition-colors shrink-0"
            title="Back to Exam Hub"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10.5px] font-black bg-[#D7E600] text-[var(--ink)] border border-[var(--ink)] px-2 py-0.5 rounded">
                {shortCode}
              </span>
              <span className="font-mono text-[11px] font-semibold text-[var(--ink-soft)]">
                Sem {subject.semester} · {notes.length} Notes · {pyqs.length} PYQs
              </span>
              {examCountdown && (
                <span
                  className={`font-mono text-[10.5px] font-black px-2 py-0.5 rounded border ${
                    examCountdown.status === 'today'
                      ? 'bg-red-500 text-white border-red-700 animate-pulse'
                      : 'bg-[var(--ink)] text-[#D7E600] border-[var(--ink)]'
                  }`}
                >
                  {examCountdown.text}
                </span>
              )}
            </div>
            <h1 className="font-display font-black text-[24px] sm:text-[28px] text-[var(--ink)] leading-tight truncate mt-0.5">
              {subject.name}
            </h1>
          </div>
        </div>

        {/* Share Subject Link */}
        <button
          type="button"
          onClick={handleCopyShareLink}
          className="font-mono text-[11.5px] font-bold px-3.5 py-2 rounded-xl border-2 border-[var(--ink)] bg-[#FAF9F5] hover:bg-[#D7E600] shadow-[2px_2px_0_var(--ink)] flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
        >
          {copiedLink ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-emerald-700" />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <Share2Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share Subject</span>
            </>
          )}
        </button>
      </div>

      {/* Main Responsive Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[370px_1fr] gap-5 flex-1 lg:h-[calc(100vh-146px)] lg:min-h-[600px]">
        {/* LEFT COLUMN: Sidebar Notes & PYQs Directory */}
        <aside className="flex flex-col gap-4 lg:overflow-y-auto lg:pr-1 pb-6">
          {/* Exam Prep Hub Summary + Unit Quick-Jump Pills */}
          <div className="bg-[var(--ink)] text-[var(--paper)] p-4 rounded-2xl border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--hl)]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1">
                <ClockIcon className="w-3 h-3 text-[#D7E600]" />
                Exam Prep Hub
              </span>
              <span className="font-mono text-[10px] font-bold text-[#D7E600]">
                ONLINE AUTO-PREVIEW
              </span>
            </div>

            <div className="text-[19px] font-black text-[#D7E600] leading-tight mb-2">
              {examCountdown ? examCountdown.text : `${notes.length + pyqs.length} Study PDFs Ready`}
            </div>

            {/* Quick Unit Jump Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/15">
              {units.map((u) => {
                const count = notes.filter((n) => (n.unit_number || 1) === u).length;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => scrollToUnitSection(String(u))}
                    className={`font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      count > 0
                        ? 'bg-white/10 hover:bg-[#D7E600] hover:text-[#201C14] text-white border-white/20'
                        : 'bg-white/5 text-white/35 border-white/10'
                    }`}
                  >
                    U{u} ({count})
                  </button>
                );
              })}
              {pyqs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPyqOpen(true);
                    setTimeout(() => scrollToUnitSection('pyq'), 50);
                  }}
                  className="font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-[#D7E600] text-[#201C14] border border-[#D7E600] cursor-pointer"
                >
                  PYQ ({pyqs.length})
                </button>
              )}
            </div>
          </div>

          {/* Previous Year Question Papers (PYQ) Collapsible Folder */}
          {pyqs.length > 0 && (
            <div
              id="web-unit-pyq"
              className="border-2 border-[var(--ink)] rounded-2xl bg-[#FAF9F5] shadow-[3px_3px_0_var(--ink)] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setIsPyqOpen((prev) => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderIcon className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="font-black text-[13px] text-[var(--ink)] truncate">
                    PREVIOUS YEAR PAPERS (PYQ)
                  </span>
                  <span className="font-mono text-[10px] font-bold bg-purple-700 text-white px-2 py-0.5 rounded-full">
                    {pyqs.length}
                  </span>
                </div>
                <ChevronDownIcon
                  className={`w-4 h-4 text-[var(--ink)] transition-transform ${
                    isPyqOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isPyqOpen && (
                <div className="p-3 pt-1 border-t border-[var(--rule-strong)] flex flex-col gap-2">
                  {pyqs.map((pyq, idx) => {
                    const pyqTitle = formatDisplayTitle(pyq, undefined, idx + 1);
                    const isActive = isDesktop && selectedDoc?.id === pyq.id;
                    const sizeMb = pyq.file_size_kb ? (pyq.file_size_kb / 1024).toFixed(1) : '0.8';
                    const bm = bookmarkTrigger >= 0 && isBookmarked(pyq.file_url);

                    return (
                      <div
                        key={pyq.id}
                        onClick={() => handleSelectDoc(pyq)}
                        className={`border-[1.5px] rounded-xl p-3 flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#D7E600] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                            : 'bg-white border-[var(--rule-strong)] hover:border-[var(--ink)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[12.5px] text-[var(--ink)] truncate">
                            {pyqTitle}
                          </div>
                          <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 flex items-center gap-1.5">
                            <span>{sizeMb} MB</span>
                            <span>·</span>
                            <span className="font-sans font-bold flex items-center gap-1">
                              <EyeIcon className="w-3 h-3" />
                              {isActive ? 'Previewing Now' : 'Tap to Preview'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleToggleBookmark(e, pyq, pyqTitle)}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                              bm
                                ? 'bg-[var(--ink)] text-[#D7E600] border-[var(--ink)]'
                                : 'bg-[var(--paper)] border-[var(--rule-strong)] text-[var(--ink)] hover:border-[var(--ink)]'
                            }`}
                            title="Bookmark PYQ"
                          >
                            <BookmarkIcon className={`w-3.5 h-3.5 ${bm ? 'fill-[#D7E600]' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleExplicitDownload(e, pyq, pyqTitle)}
                            disabled={downloadingId === pyq.id}
                            className="w-7 h-7 rounded-lg border border-[var(--rule-strong)] hover:border-[var(--ink)] bg-[var(--paper)] flex items-center justify-center text-[var(--ink)] cursor-pointer"
                            title="Download PDF"
                          >
                            {downloadingId === pyq.id ? (
                              <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <DownloadIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Lecture Notes Grouped by Unit */}
          <div className="flex flex-col gap-4">
            {units.map((unitNum) => {
              const unitNotes = notes.filter((n) => (n.unit_number || 1) === unitNum);

              return (
                <div key={unitNum} id={`web-unit-${unitNum}`} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`${getUnitColor(unitNum)} px-2.5 py-0.5 rounded-md text-[10.5px] font-black uppercase tracking-wider border border-[var(--ink)]/40`}
                    >
                      Unit {unitNum}
                    </span>
                    <div className="h-[1.5px] flex-1 bg-[var(--ink)]/15" />
                    <span className="font-mono text-[10px] font-bold text-[var(--ink-soft)]">
                      {unitNotes.length} {unitNotes.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>

                  {unitNotes.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {unitNotes.map((note, idx) => {
                        const displayTitle = formatDisplayTitle(note, unitNum, idx + 1);
                        const isActive =
                          isDesktop &&
                          selectedDoc?.id === note.id &&
                          selectedDoc?.unit_number === note.unit_number;
                        const sizeMb = note.file_size_kb
                          ? (note.file_size_kb / 1024).toFixed(1)
                          : '1.2';
                        const bm = bookmarkTrigger >= 0 && isBookmarked(note.file_url);
                        const isImp = displayTitle.toUpperCase().includes('IMP');
                        const isMulti = displayTitle.toLowerCase().includes('units ');

                        return (
                          <div
                            key={note.id || `${unitNum}_${idx}`}
                            onClick={() => handleSelectDoc(note)}
                            className={`border-2 rounded-2xl p-3 flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                              isActive
                                ? 'bg-[#D7E600] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]'
                                : 'bg-[#FAF9F5] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] hover:bg-white'
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 ${
                                isActive ? 'bg-[var(--ink)] text-[#D7E600]' : 'bg-[#D7E600] text-[var(--ink)]'
                              }`}
                            >
                              <FileTextIcon className="w-5 h-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isImp && (
                                  <span className="font-mono text-[9px] font-black bg-amber-300 text-black px-1.5 py-0.2 rounded border border-[var(--ink)]">
                                    IMP
                                  </span>
                                )}
                                {isMulti && (
                                  <span className="font-mono text-[9px] font-black bg-sky-200 text-sky-950 px-1.5 py-0.2 rounded border border-sky-800">
                                    MULTI-UNIT
                                  </span>
                                )}
                              </div>
                              <h3 className="font-extrabold text-[13px] text-[var(--ink)] leading-snug line-clamp-1">
                                {displayTitle}
                              </h3>
                              <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 flex items-center gap-1.5">
                                <span>{sizeMb} MB</span>
                                <span>·</span>
                                <span className="font-sans font-bold flex items-center gap-1 text-[var(--ink)]">
                                  <EyeIcon className="w-3 h-3" />
                                  {isActive ? 'Reading Now' : 'Instant Preview'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleToggleBookmark(e, note, displayTitle)}
                                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                  bm
                                    ? 'bg-[var(--ink)] text-[#D7E600] border-[var(--ink)]'
                                    : 'bg-white border-[var(--rule-strong)] text-[var(--ink)] hover:border-[var(--ink)]'
                                }`}
                                title="Bookmark Note"
                              >
                                <BookmarkIcon className={`w-3.5 h-3.5 ${bm ? 'fill-[#D7E600]' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleExplicitDownload(e, note, displayTitle)}
                                disabled={downloadingId === note.id}
                                className="w-7 h-7 rounded-lg border border-[var(--rule-strong)] hover:border-[var(--ink)] bg-white flex items-center justify-center text-[var(--ink)] cursor-pointer"
                                title="Download PDF Copy"
                              >
                                {downloadingId === note.id ? (
                                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <DownloadIcon className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-xl p-3 bg-white/60 text-[11.5px] font-semibold text-[var(--ink-soft)] flex items-center justify-between">
                      <span>No notes uploaded for Unit {unitNum} yet</span>
                      <span className="font-mono text-[9.5px] uppercase px-2 py-0.5 bg-[var(--paper-deep)] rounded">
                        SOON
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* RIGHT COLUMN (Laptop/Desktop): Automatic Live PDF Preview & Reader */}
        {isDesktop && (
          <section className="h-full min-h-[600px] overflow-hidden flex flex-col">
            {selectedDoc && selectedDoc.file_url ? (
              <WebPDFReader
                fileUrl={selectedDoc.file_url}
                title={formatDisplayTitle(selectedDoc)}
                fileSizeKb={selectedDoc.file_size_kb}
                subjectId={subject.id}
                subjectName={subject.name}
                shortCode={shortCode}
                contentType={selectedDoc.type === 'pyq' ? 'pyq' : 'note'}
                unitNumber={selectedDoc.unit_number}
                itemId={selectedDoc.id}
                hasPrevDoc={activeDocIndex > 0}
                hasNextDoc={activeDocIndex >= 0 && activeDocIndex < orderedDocs.length - 1}
                onPrevDoc={() => {
                  if (activeDocIndex > 0) handleSelectDoc(orderedDocs[activeDocIndex - 1]);
                }}
                onNextDoc={() => {
                  if (activeDocIndex >= 0 && activeDocIndex < orderedDocs.length - 1) {
                    handleSelectDoc(orderedDocs[activeDocIndex + 1]);
                  }
                }}
                fullscreenHref={`/read?file=${encodeURIComponent(selectedDoc.file_url)}&title=${encodeURIComponent(
                  formatDisplayTitle(selectedDoc)
                )}&subjectId=${encodeURIComponent(subject.id)}`}
              />
            ) : (
              <div className="h-full rounded-2xl border-2 border-dashed border-[var(--rule-strong)] bg-[var(--paper-card)] flex flex-col items-center justify-center p-10 text-center">
                <FileTextIcon className="w-12 h-12 text-[var(--ink-faint)] mb-3" />
                <h2 className="font-display font-black text-[24px] text-[var(--ink)]">
                  Select any Unit or PYQ to Preview
                </h2>
                <p className="text-[13px] text-[var(--ink-soft)] max-w-sm mt-1">
                  Materials for this subject will stream and preview right here without needing to download anything.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

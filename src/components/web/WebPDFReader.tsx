'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  Maximize2Icon,
  Minimize2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  BookmarkIcon,
  Loader2Icon,
  RotateCcwIcon,
  FileWarningIcon,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getWebPdfStreamUrl, downloadWebPdf } from '@/lib/pdfUrl';
import { isBookmarked, toggleWebBookmark, recordWebHistory } from '@/lib/bookmarks';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface WebPDFReaderProps {
  fileUrl: string;
  title: string;
  fileSizeKb?: number | null;
  subjectId?: string;
  subjectName?: string;
  shortCode?: string;
  contentType?: 'note' | 'pyq';
  unitNumber?: number | null;
  itemId?: string;
  initialPage?: number;
  showBackButton?: boolean;
  onBack?: () => void;
  onPrevDoc?: () => void;
  onNextDoc?: () => void;
  hasPrevDoc?: boolean;
  hasNextDoc?: boolean;
  fullscreenHref?: string;
}

export default function WebPDFReader({
  fileUrl,
  title,
  fileSizeKb,
  subjectId = '',
  subjectName = '',
  shortCode = 'SUB',
  contentType = 'note',
  unitNumber = null,
  itemId = '',
  initialPage = 1,
  showBackButton = false,
  onBack,
  onPrevDoc,
  onNextDoc,
  hasPrevDoc = false,
  hasNextDoc = false,
  fullscreenHref,
}: WebPDFReaderProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage));
  const [pageInput, setPageInput] = useState<string>(String(Math.max(1, initialPage)));
  const [zoom, setZoom] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrySeed, setRetrySeed] = useState<number>(0);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [bookmarked, setBookmarked] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const initialJumpDoneRef = useRef<boolean>(false);

  const streamUrl = useMemo(() => getWebPdfStreamUrl(fileUrl), [fileUrl]);

  // Memoize Document file options so PDF.js doesn't reload when zoom/page state changes
  const documentSource = useMemo(
    () => ({
      url: streamUrl,
      rangeChunkSize: 131072, // 128 KB chunks for rapid page-by-page streaming
    }),
    [streamUrl, retrySeed]
  );

  // Sync bookmark status and reset reader state when switching files
  useEffect(() => {
    setBookmarked(isBookmarked(fileUrl));
    setNumPages(0);
    setLoadError(null);
    const startPage = Math.max(1, initialPage);
    setCurrentPage(startPage);
    setPageInput(String(startPage));
    initialJumpDoneRef.current = false;

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    recordWebHistory({
      fileUrl,
      title,
      subjectId,
      subjectName,
      page: startPage,
    });
  }, [fileUrl, title, subjectId, subjectName, initialPage]);

  useEffect(() => {
    const syncBm = () => setBookmarked(isBookmarked(fileUrl));
    window.addEventListener('semkit_web_bookmarks_changed', syncBm);
    return () => window.removeEventListener('semkit_web_bookmarks_changed', syncBm);
  }, [fileUrl]);

  // Responsive page width observer
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth || window.innerWidth);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [isFullscreen]);

  // Sync body fullscreen attribute so global web header stays hidden when expanded
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('pdf-fullscreen-active');
    } else {
      document.body.classList.remove('pdf-fullscreen-active');
    }
    return () => document.body.classList.remove('pdf-fullscreen-active');
  }, [isFullscreen]);

  const baseWidth = useMemo(() => {
    const padding = containerWidth < 640 ? 20 : 56;
    return Math.min(Math.max(containerWidth - padding, 280), 860);
  }, [containerWidth]);

  const renderedWidth = Math.round(baseWidth * zoom);
  const estimatedPageHeight = Math.round(renderedWidth * 1.414);

  const persistProgress = useCallback(
    (page: number, total: number) => {
      if (!fileUrl) return;
      try {
        localStorage.setItem(
          'semkit_last_read',
          JSON.stringify({
            file: fileUrl,
            title: title || 'Study Notes',
            page,
            total,
            subjectId,
            timestamp: Date.now(),
          })
        );
        window.dispatchEvent(new Event('semkit_last_read_updated'));
        recordWebHistory({
          fileUrl,
          title,
          subjectId,
          subjectName,
          page,
          total,
        });
      } catch {
        // Ignore storage errors
      }
    },
    [fileUrl, title, subjectId, subjectName]
  );

  // Track visible page numbers smoothly via IntersectionObserver
  useEffect(() => {
    if (!numPages || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const visibilityRatios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const p = Number((entry.target as HTMLElement).dataset.pageNumber);
          if (p) {
            visibilityRatios.set(p, entry.intersectionRatio);
          }
        }

        let bestPage = currentPage;
        let bestRatio = -1;
        visibilityRatios.forEach((ratio, pageNum) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = pageNum;
          }
        });

        if (bestRatio > 0 && bestPage !== currentPage) {
          setCurrentPage(bestPage);
          setPageInput(String(bestPage));
          persistProgress(bestPage, numPages);
        }
      },
      {
        root: container,
        threshold: [0.1, 0.35, 0.65],
      }
    );

    pageRefs.current.forEach((node) => {
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [numPages, renderedWidth, currentPage, persistProgress]);

  const jumpToPage = useCallback(
    (target: number) => {
      if (!numPages) return;
      const clamped = Math.min(Math.max(1, target), numPages);
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      const el = pageRefs.current.get(clamped);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      persistProgress(clamped, numPages);
    },
    [numPages, persistProgress]
  );

  const handleLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoadError(null);
    const startPage = Math.min(Math.max(1, initialPage), total);
    setCurrentPage(startPage);
    setPageInput(String(startPage));
    persistProgress(startPage, total);

    if (startPage > 1 && !initialJumpDoneRef.current) {
      initialJumpDoneRef.current = true;
      setTimeout(() => {
        const el = pageRefs.current.get(startPage);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 120);
    }
  };

  // Keyboard shortcuts when fullscreen or inside reader
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === 'ArrowRight' && currentPage < numPages) {
        jumpToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' && currentPage > 1) {
        jumpToPage(currentPage - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, currentPage, numPages, jumpToPage]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed)) {
      jumpToPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleToggleBookmark = () => {
    const next = toggleWebBookmark({
      id: itemId || fileUrl,
      fileUrl,
      title,
      subjectId,
      subjectName,
      shortCode,
      type: contentType,
      unitNumber,
      fileSizeKb,
    });
    setBookmarked(next);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadWebPdf(fileUrl, title);
    } finally {
      setDownloading(false);
    }
  };

  // Virtualized page window so even 100-page PDFs open instantaneously on mobile/desktop
  const visibleStart = Math.max(1, currentPage - 3);
  const visibleEnd = numPages ? Math.min(numPages, currentPage + 5) : 1;

  const sizeMb = fileSizeKb ? `${(fileSizeKb / 1024).toFixed(1)} MB` : null;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] flex flex-col bg-[#1B1915] text-[var(--paper)]'
          : 'flex flex-col h-full w-full border-2 border-[var(--ink)] rounded-2xl overflow-hidden bg-[#1B1915] shadow-[4px_4px_0_var(--ink)]'
      }
    >
      {/* Reader Control Toolbar */}
      <div className="bg-[var(--ink)] text-[var(--paper)] border-b border-white/15 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        {/* Left: Back (optional) + Active Title + Size */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBackButton && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              title="Back"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="font-bold text-[13px] sm:text-[14px] text-[var(--paper)] truncate leading-tight">
              {title}
            </div>
            <div className="font-mono text-[10px] text-[#D7E600] flex items-center gap-2 mt-0.5">
              <span>AUTO-PREVIEW READER</span>
              {sizeMb && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="text-white/75">{sizeMb}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right Controls */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {/* Document Switcher (Prev / Next Unit Note inside Subject View) */}
          {(onPrevDoc || onNextDoc) && (
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/15">
              <button
                type="button"
                onClick={onPrevDoc}
                disabled={!hasPrevDoc}
                className="px-2 py-1 text-[11px] font-bold flex items-center gap-0.5 rounded hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Document"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                type="button"
                onClick={onNextDoc}
                disabled={!hasNextDoc}
                className="px-2 py-1 text-[11px] font-bold flex items-center gap-0.5 rounded hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                title="Next Document"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Page Jump Indicator */}
          {numPages > 0 && (
            <form
              onSubmit={handlePageInputSubmit}
              className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 border border-white/15 font-mono text-[11px]"
            >
              <input
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputSubmit}
                aria-label="Current Page"
                className="w-7 bg-white/15 text-center font-bold text-white rounded px-0.5 py-0.5 outline-none focus:ring-1 focus:ring-[#D7E600]"
              />
              <span className="text-white/70">/ {numPages}</span>
            </form>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/15">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/15 cursor-pointer"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOutIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.0)}
              className="px-1.5 font-mono text-[11px] font-bold hover:text-[#D7E600] cursor-pointer"
              title="Reset Zoom to Fit"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.15).toFixed(2))))}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/15 cursor-pointer"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomInIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleToggleBookmark}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
              bookmarked
                ? 'bg-[#D7E600] border-[#D7E600] text-[#201C14]'
                : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
            }`}
            title={bookmarked ? 'Remove Bookmark' : 'Bookmark for Exam Prep'}
          >
            <BookmarkIcon className={`w-4 h-4 ${bookmarked ? 'fill-[#201C14]' : ''}`} />
          </button>

          {/* Optional Download PDF */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#D7E600] hover:text-[#201C14] border border-white/15 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title="Download PDF Copy (Optional)"
          >
            {downloading ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <DownloadIcon className="w-4 h-4" />
            )}
          </button>

          {/* Open Raw PDF in New Tab */}
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 items-center justify-center transition-colors"
            title="Open Raw PDF in New Browser Tab"
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </a>

          {/* Dedicated Fullscreen Page OR In-place Fullscreen Expand */}
          {fullscreenHref && !isFullscreen ? (
            <Link
              href={fullscreenHref}
              className="w-8 h-8 rounded-lg bg-[#D7E600] text-[#201C14] hover:bg-[#c8d800] border border-[#201C14] flex items-center justify-center transition-colors"
              title="Open Dedicated Full-Page Reader"
            >
              <Maximize2Icon className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="w-8 h-8 rounded-lg bg-[#D7E600] text-[#201C14] hover:bg-[#c8d800] border border-[#201C14] flex items-center justify-center transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
            >
              {isFullscreen ? (
                <Minimize2Icon className="w-4 h-4" />
              ) : (
                <Maximize2Icon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Online PDF Canvas Viewport */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-[#23201B] py-5 px-2 sm:px-6 flex flex-col items-center relative"
      >
        {loadError ? (
          <div className="my-auto max-w-md bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-2xl p-6 text-center shadow-[4px_4px_0_var(--ink)]">
            <FileWarningIcon className="w-10 h-10 text-[var(--red)] mx-auto mb-3" />
            <h3 className="font-black text-[18px] mb-1">Could not stream PDF inline</h3>
            <p className="text-[12.5px] text-[var(--ink-soft)] mb-4">
              {loadError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setRetrySeed((s) => s + 1);
                }}
                className="btn btn-p text-[12px] cursor-pointer"
              >
                <RotateCcwIcon className="w-3.5 h-3.5" />
                Retry Preview
              </button>
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-s text-[12px]"
              >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                Open in Browser Tab
              </a>
            </div>
          </div>
        ) : (
          <Document
            file={documentSource}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={(err) => setLoadError(err?.message || 'Unable to fetch PDF stream.')}
            loading={
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <Loader2Icon className="w-8 h-8 animate-spin text-[#D7E600]" />
                <div className="text-[13px] font-bold text-[var(--paper)]">
                  Streaming PDF Preview...
                </div>
                <div className="font-mono text-[11px] text-white/50">
                  Instant online view · No download required
                </div>
              </div>
            }
            className="flex flex-col items-center gap-4"
          >
            {Array.from({ length: numPages }, (_, i) => {
              const pageNumber = i + 1;
              const shouldRender = pageNumber >= visibleStart && pageNumber <= visibleEnd;

              return (
                <div
                  key={`web_page_${pageNumber}_${retrySeed}`}
                  data-page-number={pageNumber}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNumber, el);
                    else pageRefs.current.delete(pageNumber);
                  }}
                  style={{
                    width: renderedWidth,
                    minHeight: estimatedPageHeight,
                  }}
                  className="bg-white rounded-[4px] shadow-[0_6px_24px_rgba(0,0,0,0.45)] overflow-hidden flex items-center justify-center relative shrink-0"
                >
                  {shouldRender ? (
                    <Page
                      pageNumber={pageNumber}
                      width={renderedWidth}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div className="flex items-center justify-center w-full h-full py-20 text-zinc-400">
                          <Loader2Icon className="w-5 h-5 animate-spin mr-2" />
                          <span className="font-mono text-[11px]">Page {pageNumber}...</span>
                        </div>
                      }
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400 py-16">
                      <span className="font-mono text-[11px] font-bold">Page {pageNumber}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </Document>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookmarkIcon,
  ClockIcon,
  EyeIcon,
  TrashIcon,
  FileTextIcon,
  BookOpenIcon,
} from 'lucide-react';
import {
  getWebBookmarks,
  getWebHistory,
  toggleWebBookmark,
  type WebBookmark,
} from '@/lib/bookmarks';

export function WebSaved() {
  const [bookmarks, setBookmarks] = useState<WebBookmark[]>([]);
  const [history, setHistory] = useState<ReturnType<typeof getWebHistory>>([]);

  const loadData = () => {
    setBookmarks(getWebBookmarks());
    setHistory(getWebHistory());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('semkit_web_bookmarks_changed', loadData);
    return () => window.removeEventListener('semkit_web_bookmarks_changed', loadData);
  }, []);

  const handleRemoveBookmark = (bm: WebBookmark) => {
    toggleWebBookmark(bm);
    loadData();
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display font-black text-[32px] sm:text-[38px] text-[var(--ink)] leading-none">
          STUDY BOOKMARKS & READING HISTORY
        </h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
          Pin key notes & previous year papers while revising online so you can reopen their auto-preview in one click.
        </p>
      </div>

      {/* Bookmarks Section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <BookmarkIcon className="w-4 h-4 text-[var(--ink)] fill-[#D7E600]" />
          <h2 className="font-mono text-[12px] font-bold uppercase tracking-wider text-[var(--ink)]">
            Pinned Study Materials ({bookmarks.length})
          </h2>
        </div>

        {bookmarks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookmarks.map((bm) => {
              const sizeMb = bm.fileSizeKb ? `${(bm.fileSizeKb / 1024).toFixed(1)} MB` : 'PDF';
              const targetHref = bm.subjectId
                ? `/subject?id=${encodeURIComponent(bm.subjectId)}&doc=${encodeURIComponent(bm.id)}`
                : `/read?file=${encodeURIComponent(bm.fileUrl)}&title=${encodeURIComponent(bm.title)}`;

              return (
                <div
                  key={bm.fileUrl}
                  className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[#FAF9F5] shadow-[3px_3px_0_var(--ink)] flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[10.5px] font-black bg-[#D7E600] border border-[var(--ink)] px-2 py-0.5 rounded">
                        {bm.shortCode || 'NOTES'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBookmark(bm)}
                        className="text-[var(--ink-soft)] hover:text-[var(--red)] p-1 cursor-pointer"
                        title="Remove Bookmark"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="font-extrabold text-[15px] text-[var(--ink)] leading-snug line-clamp-2">
                      {bm.title}
                    </h3>
                    <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-1">
                      {bm.subjectName || 'Study PDF'} · {sizeMb}
                    </div>
                  </div>

                  <Link
                    href={targetHref}
                    className="btn btn-p justify-center text-[12px] w-full"
                  >
                    <EyeIcon className="w-3.5 h-3.5" />
                    <span>Open Auto-Preview</span>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-10 bg-[var(--paper-card)] text-center">
            <BookmarkIcon className="w-9 h-9 mx-auto mb-2 text-[var(--ink-faint)]" />
            <p className="font-bold text-[14.5px] text-[var(--ink)]">No bookmarked notes yet</p>
            <p className="text-[12.5px] text-[var(--ink-soft)] mt-1 mb-4">
              Click the bookmark icon next to any Unit PDF or PYQ while studying to pin it here.
            </p>
            <Link href="/" className="btn btn-p inline-flex text-[12.5px]">
              <BookOpenIcon className="w-4 h-4" /> Explore Subjects
            </Link>
          </div>
        )}
      </section>

      {/* Reading History Section */}
      {history.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClockIcon className="w-4 h-4 text-[var(--ink)]" />
            <h2 className="font-mono text-[12px] font-bold uppercase tracking-wider text-[var(--ink)]">
              Recently Opened PDFs ({history.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {history.map((item) => (
              <Link
                key={item.fileUrl}
                href={`/read?file=${encodeURIComponent(item.fileUrl)}&title=${encodeURIComponent(
                  item.title
                )}&page=${item.page || 1}${item.subjectId ? `&subjectId=${item.subjectId}` : ''}`}
                className="border-2 border-[var(--ink)] rounded-2xl p-3.5 bg-[#FAF9F5] hover:bg-white shadow-[2px_2px_0_var(--ink)] flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--paper-deep)] border border-[var(--ink)] flex items-center justify-center shrink-0">
                    <FileTextIcon className="w-4 h-4 text-[var(--ink)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13.5px] text-[var(--ink)] truncate">
                      {item.title}
                    </div>
                    <div className="font-mono text-[10.5px] text-[var(--ink-soft)] truncate">
                      {item.subjectName ? `${item.subjectName} · ` : ''}
                      {item.page ? `Page ${item.page}${item.total ? `/${item.total}` : ''}` : 'Opened online'}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10.5px] font-bold bg-[#D7E600] border border-[var(--ink)] px-2.5 py-1 rounded-lg shrink-0">
                  Resume →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

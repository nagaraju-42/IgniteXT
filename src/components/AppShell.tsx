'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { BottomNav } from '@/components/BottomNav';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { WebNavbar } from '@/components/web/WebNavbar';
import { WebSpaceGuard } from '@/components/web/WebSpaceGuard';
import { useIsNativeApp } from '@/lib/useIsNativeApp';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nativeMode = useIsNativeApp();

  // =========================================================================
  // 1. NATIVE APK SHELL — 100% UNCHANGED ORIGINAL PHONE EXPERIENCE
  // =========================================================================
  if (nativeMode) {
    return (
      <div className="flex justify-center h-screen h-[100dvh] overflow-hidden bg-[var(--paper)]">
        <div className="w-full max-w-[428px] h-full border-x-[3px] border-[var(--ink)] bg-[var(--paper-card)] flex flex-col shadow-[6px_6px_0_var(--paper-deep)] md:my-auto md:h-[94vh] md:rounded-[34px] md:border-y-[3px] overflow-hidden relative">
          <HeaderBar />
          <main className="flex-1 overflow-y-auto no-scrollbar">{children}</main>
          <BottomNav />
          <FeedbackWidget />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. RESPONSIVE ONLINE WEBSITE SHELL (Desktop Laptop & Mobile Web)
  // =========================================================================
  const isReaderRoute = pathname.startsWith('/read') || pathname.startsWith('/subject');
  const requiresSpaceSetup =
    pathname.startsWith('/browse') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/saved') ||
    pathname.startsWith('/subject') ||
    pathname.startsWith('/read');
  const isCenteredUtilityRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/deletion');

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)] text-[var(--ink)]">
      <WebNavbar />

      <main className="flex-1 w-full flex flex-col">
        {isCenteredUtilityRoute ? (
          <div className="w-full max-w-3xl mx-auto px-2 sm:px-6 py-4 flex-1 flex flex-col">
            {children}
          </div>
        ) : requiresSpaceSetup ? (
          <WebSpaceGuard>{children}</WebSpaceGuard>
        ) : (
          children
        )}
      </main>

      {/* Clean Website Footer (hidden in dedicated split/fullscreen reader workspaces) */}
      {!isReaderRoute && (
        <footer
          data-hide-on-pdf-fullscreen="true"
          className="border-t-2 border-[var(--rule-strong)] bg-[var(--paper-card)] py-6 px-4 sm:px-6 mt-auto"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[var(--ink-soft)]">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="SemKit" className="w-5 h-5 object-contain" />
              <span className="font-bold text-[var(--ink)]">SemKit Exam Prep</span>
              <span>·</span>
              <span>Free online PDF notes & PYQs with instant preview</span>
            </div>
            <div className="flex items-center gap-4 font-medium">
              <Link href="/browse" className="hover:text-[var(--ink)] hover:underline">
                Browse Subjects
              </Link>
              <Link href="/support" className="hover:text-[var(--ink)] hover:underline">
                Request Notes / Support
              </Link>
              <Link href="/privacy" className="hover:text-[var(--ink)] hover:underline">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

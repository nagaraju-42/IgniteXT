'use client';

import Link from 'next/link';
import { ClockIcon, ChevronLeftIcon } from 'lucide-react';

export default function PendingPage() {
  return (
    <div className="flex flex-col h-full bg-[var(--paper-card)] min-h-screen">
      <div className="px-[18px] pt-4 pb-4 border-b border-[var(--rule)] bg-[var(--paper)]">
        <Link href="/" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <ChevronLeftIcon className="w-4 h-4" /> Back Home
        </Link>
      </div>

      <div className="px-[18px] py-8 flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
        <div className="w-16 h-16 bg-[var(--paper-deep)] rounded-full flex items-center justify-center mb-6">
          <ClockIcon className="w-8 h-8 text-[var(--ink-soft)]" />
        </div>
        
        <h1 className="font-bold text-[24px] mb-3">Application Received!</h1>
        <p className="text-[14px] text-[var(--ink-soft)] mb-8 max-w-[280px]">
          Thanks for stepping up to help your peers. A Superadmin will review your application shortly.
        </p>

        <div className="border-[1.5px] border-[var(--rule-strong)] bg-[var(--paper)] rounded-xl p-5 w-full text-left">
          <h2 className="font-semibold text-[13px] mb-2 uppercase tracking-wide text-[var(--ink-soft)]">What happens next?</h2>
          <ul className="text-[13px] flex flex-col gap-3">
            <li className="flex gap-2">
              <span className="text-[var(--ink-faint)]">1.</span>
              <span>We verify your college details.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--ink-faint)]">2.</span>
              <span>Your account gets approved.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--ink-faint)]">3.</span>
              <span>You can start uploading notes and solving PYQ requests!</span>
            </li>
          </ul>
        </div>
        
        <Link href="/" className="mt-8 font-bold text-[14px] text-[var(--ink)] underline">
          Return to Browse
        </Link>
      </div>
    </div>
  );
}

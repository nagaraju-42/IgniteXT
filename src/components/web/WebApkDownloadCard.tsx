'use client';

import React, { useEffect, useState } from 'react';
import { DownloadIcon, SmartphoneIcon, CopyIcon, CheckIcon } from 'lucide-react';

const APK_PATH = '/SemKit.apk';

/**
 * Direct Android APK download card rendered on the website.
 * Serves `releases/SemKit.apk` from Cloudflare R2 via the same-origin `/SemKit.apk` rewrite.
 */
export function WebApkDownloadCard() {
  const [origin, setOrigin] = useState<string>('https://ignite-xt-topaz.vercel.app');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const fullUrl = `${origin}${APK_PATH}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API fallback ignored cleanly
    }
  };

  return (
    <section
      aria-label="Download SemKit Android App"
      className="border-2 border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] shadow-[4px_4px_0_var(--ink)] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
    >
      <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-wider bg-[var(--ink)] text-[#D7E600] px-2.5 py-0.5 rounded mb-2">
          <SmartphoneIcon className="w-3 h-3" />
          <span>Android App · v1.0 · 10.4 MB · Offline Ready</span>
        </div>

        <h2 className="font-display font-black text-[22px] sm:text-[26px] text-[var(--ink)] leading-tight">
          GET THE SEMKIT ANDROID APP
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)] mt-1 max-w-2xl leading-relaxed">
          Prefer offline access on your phone? Install the SemKit Android APK to save notes for exam hall prep without internet.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="font-mono font-bold text-[var(--ink-soft)] uppercase">
            Download APK (Android):
          </span>
          <a
            href={APK_PATH}
            download="SemKit.apk"
            className="font-mono font-bold text-[var(--ink)] underline decoration-[var(--ink)] underline-offset-2 break-all hover:bg-[#D7E600]/50 px-1 rounded transition-colors"
          >
            {fullUrl}
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1 font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-[var(--rule-strong)] hover:border-[var(--ink)] bg-[var(--paper)] hover:bg-[#D7E600] text-[var(--ink)] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3 h-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="shrink-0">
        <a
          href={APK_PATH}
          download="SemKit.apk"
          className="w-full md:w-auto md:min-w-[260px] bg-[#D7E600] text-[var(--ink)] font-black text-[15px] px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--ink)] transition-all"
        >
          <DownloadIcon className="w-5 h-5" />
          <span>Download APK (Android)</span>
        </a>
      </div>
    </section>
  );
}

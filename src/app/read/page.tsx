'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeftIcon, Loader2Icon, ShareIcon } from 'lucide-react';
import { OfflineManager } from '@/lib/offlineManager';

import { requireStudentAccess } from "@/components/StudentGate";

function PDFReader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const file = searchParams.get('file');
  const remoteUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Document';
  
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    requireStudentAccess(() => {
      setAuthorized(true);
    });
  }, []);

  useEffect(() => {
    if (!authorized) return;

    if (file) {
      OfflineManager.getOfflineFileDataUri(file).then(uri => {
        if (uri) {
          setDataUri(uri);
        } else {
          setError(true);
        }
      });
    } else if (remoteUrl) {
      // If it's a remote URL, we use the Google Docs Viewer directly
      setDataUri(`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(remoteUrl)}`);
    } else {
      setError(true);
    }
  }, [file, remoteUrl]);

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] absolute inset-0 z-50">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper-card)] flex items-center justify-between shadow-sm shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </button>
        <div className="font-bold text-[14px] truncate flex-1 mx-4 text-center">{title}</div>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--paper-deep)] hover:bg-[var(--hl)] transition-colors">
          <ShareIcon className="w-4 h-4 text-[var(--ink)]" />
        </button>
      </div>
      
      <div className="flex-1 bg-gray-100 relative">
        {!dataUri && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--ink)] gap-3">
            <Loader2Icon className="w-8 h-8 animate-spin" />
            <span className="text-[13px] font-medium opacity-80">Loading document...</span>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--ink)] gap-3">
            <span className="text-[14px] font-medium">Failed to load document.</span>
            <button onClick={() => router.back()} className="px-4 py-2 bg-[var(--ink)] text-white rounded-lg text-sm font-bold">Go Back</button>
          </div>
        )}

        {dataUri && (
          <iframe 
            src={dataUri} 
            className="w-full h-full border-none absolute inset-0"
            title={title}
          />
        )}
      </div>

      {/* AdMob Banner Placeholder */}
      <div className="h-[60px] bg-[var(--paper-deep)] border-t border-[var(--rule-strong)] flex items-center justify-center shrink-0">
        <span className="text-[11px] font-mono text-[var(--ink-faint)] uppercase tracking-widest border border-dashed border-[var(--ink-faint)] px-4 py-1 rounded">
          AdMob Banner Placeholder
        </span>
      </div>
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2Icon className="w-6 h-6 animate-spin mx-auto"/></div>}>
      <PDFReader />
    </Suspense>
  );
}

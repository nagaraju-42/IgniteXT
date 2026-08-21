'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeftIcon, Loader2Icon, ShareIcon } from 'lucide-react';
import { OfflineManager } from '@/lib/offlineManager';

function PDFReader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const file = searchParams.get('file');
  const title = searchParams.get('title') || 'Document';
  
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (file) {
      OfflineManager.getOfflineFileDataUri(file).then(uri => {
        if (uri) {
          setDataUri(uri);
        } else {
          setError(true);
        }
      });
    } else {
      setError(true);
    }
  }, [file]);

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] absolute inset-0 z-50">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper-card)] flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </button>
        <div className="font-bold text-[14px] truncate flex-1 mx-4 text-center">{title}</div>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--paper-deep)] hover:bg-[var(--hl)] transition-colors">
          <ShareIcon className="w-4 h-4 text-[var(--ink)]" />
        </button>
      </div>
      
      <div className="flex-1 bg-black relative">
        {!dataUri && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <Loader2Icon className="w-8 h-8 animate-spin" />
            <span className="text-[13px] font-medium opacity-80">Loading offline document...</span>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <span className="text-[14px] font-medium">Failed to load document.</span>
            <button onClick={() => router.back()} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold">Go Back</button>
          </div>
        )}

        {dataUri && (
          <iframe 
            src={dataUri} 
            className="w-full h-full border-none"
            title={title}
          />
        )}
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

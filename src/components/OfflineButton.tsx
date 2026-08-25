'use client';

import { useState, useEffect } from "react";
import { DownloadIcon, CheckIcon, Loader2Icon, PlayIcon } from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { recordDownload } from "@/lib/api";

interface OfflineButtonProps {
  contentId: string;
  fileUrl: string;
  title: string;
  sizeKb?: number;
}

export function OfflineButton({ contentId, fileUrl, title, sizeKb }: OfflineButtonProps) {
  const [status, setStatus] = useState<'checking' | 'not_downloaded' | 'downloading' | 'downloaded'>('checking');
  const filename = OfflineManager.getFileName(fileUrl);
  const router = useRouter();

  useEffect(() => {
    checkStatus();
  }, [filename]);

  async function checkStatus() {
    // Basic check to see if we're in the browser without capacitor (it will throw or return false)
    const isOffline = await OfflineManager.isFileDownloaded(filename);
    setStatus(isOffline ? 'downloaded' : 'not_downloaded');
  }

  async function handleAction(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (status === 'downloaded') {
      // Open the offline PDF directly
      const success = await OfflineManager.openNativeFile(contentId, fileUrl);
      if (!success) {
        alert('Could not open offline file.');
      }
    } else if (status === 'not_downloaded') {
      // Prepend R2 Public URL if it's just a key, and ensure spaces are properly encoded
      let downloadUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileUrl}`;
      downloadUrl = encodeURI(downloadUrl);
      
      // On Web, Capacitor's download implementation hits Cloudflare CORS restrictions.
      // It's best to just trigger a native browser download/open for web users!
      if (Capacitor.getPlatform() === 'web') {
        recordDownload(contentId).catch(console.error);
        window.open(downloadUrl, '_blank');
        return; // Don't try to save offline
      }

      // Native Mobile Flow (Android/iOS)
      setStatus('downloading');
      recordDownload(contentId).catch(console.error);
      
      const path = await OfflineManager.downloadFile(downloadUrl, filename);
      if (path) {
        OfflineManager.saveMetadata(filename, title, sizeKb);
        setStatus('downloaded');
      } else {
        alert("Download failed. Please check your internet connection.");
        setStatus('not_downloaded');
      }
    }
  }

  if (status === 'checking') {
    return (
      <button className="w-8 h-8 rounded-full border-[1.5px] border-[var(--rule-strong)] flex items-center justify-center shrink-0 bg-[var(--paper-deep)]" disabled>
        <div className="w-3 h-3 border-[1.5px] border-[var(--ink-faint)] border-t-transparent rounded-full animate-spin" />
      </button>
    );
  }

  if (status === 'downloading') {
    return (
      <button className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--paper-card)]" disabled>
        <Loader2Icon className="w-4 h-4 animate-spin text-[var(--ink)]" />
      </button>
    );
  }

  if (status === 'downloaded') {
    return (
      <button 
        onClick={handleAction}
        className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--hl)] hover:bg-[var(--hl-deep)] transition-colors group"
      >
        <PlayIcon className="w-3.5 h-3.5 text-[var(--ink)] ml-0.5" />
      </button>
    );
  }

  return (
    <button 
      onClick={handleAction}
      className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--paper-card)] hover:bg-[var(--paper-deep)] transition-colors"
    >
      <DownloadIcon className="w-4 h-4" />
    </button>
  );
}

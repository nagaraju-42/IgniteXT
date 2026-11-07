'use client';

import { useState, useEffect } from "react";
import { DownloadIcon, Loader2Icon, PlayIcon, EyeIcon, ShareIcon } from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { useRouter } from "next/navigation";
import { recordDownload } from "@/lib/api";
import { TipJarModal } from "./TipJarModal";

interface OfflineButtonProps {
  contentId: string;
  fileUrl: string;
  title: string;
  sizeKb?: number;
}

export function OfflineButton({ contentId, fileUrl, title, sizeKb }: OfflineButtonProps) {
  const [status, setStatus] = useState<'checking' | 'not_downloaded' | 'downloading' | 'downloaded'>('checking');
  const [showTipJar, setShowTipJar] = useState(false);
  const filename = OfflineManager.getFileName(fileUrl);
  const router = useRouter();

  const DEFAULT_R2_URL = 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev';
  const getOnlineUrl = () => fileUrl.startsWith('http') ? fileUrl : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${fileUrl}`;

  useEffect(() => {
    checkStatus();
  }, [filename]);

  async function checkStatus() {
    const isOffline = await OfflineManager.isFileDownloaded(filename);
    setStatus(isOffline ? 'downloaded' : 'not_downloaded');
  }

  async function handlePreview(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.open(getOnlineUrl(), '_blank');
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { Share } = await import('@capacitor/share');
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform() && status === 'downloaded') {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { uri } = await Filesystem.getUri({
          path: `pdf_cache/${filename}`,
          directory: Directory.Data
        });
        await Share.share({
          title: title,
          text: `Check out this file: ${title}`,
          url: uri,
          dialogTitle: 'Share with other apps',
        });
      } else {
        // If not downloaded or on web, share the link!
        if (navigator.share) {
          navigator.share({ title: title, url: getOnlineUrl() });
        } else {
          // Fallback
          prompt("Copy this link to share:", getOnlineUrl());
        }
      }
    } catch (e) {
      console.log('Share error', e);
    }
  }

  async function handleAction(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (status === 'downloaded') {
      try {
        const isPdf = filename.toLowerCase().endsWith('.pdf');
        
        // If it's a PDF, open it inside our IgniteXT app reader!
        if (isPdf) {
          router.push(`/read?file=${encodeURIComponent(filename)}&title=${encodeURIComponent(title)}`);
          return;
        }

        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { FileOpener } = await import('@capacitor-community/file-opener');
        const { Capacitor } = await import('@capacitor/core');

        if (Capacitor.isNativePlatform()) {
          const { uri } = await Filesystem.getUri({
            path: `pdf_cache/${filename}`,
            directory: Directory.Data
          });
          await FileOpener.open({ filePath: uri });
          return;
        } else {
          window.open(getOnlineUrl(), '_blank');
        }
      } catch (error) {
        console.error(error);
        alert("Could not open this file natively.");
      }
    } else if (status === 'not_downloaded') {
      setStatus('downloading');
      recordDownload(contentId).catch(console.error);
      
      const path = await OfflineManager.downloadFile(getOnlineUrl(), filename);
      if (path) {
        OfflineManager.saveMetadata(filename, title, sizeKb);
        setStatus('downloaded');
        setShowTipJar(true);
      } else {
        alert("Download failed. Please check your internet connection.");
        setStatus('not_downloaded');
      }
    }
  }

  const renderActionBtn = () => {
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
        <button onClick={handleAction} className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--hl)] hover:bg-[var(--hl-deep)] transition-colors group">
          <PlayIcon className="w-3.5 h-3.5 text-[var(--ink)] ml-0.5" />
        </button>
      );
    }
    return (
      <button onClick={handleAction} className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--paper-card)] hover:bg-[var(--paper-deep)] transition-colors">
        <DownloadIcon className="w-4 h-4" />
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button 
          onClick={handleShare}
          className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ShareIcon className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={handlePreview}
          className="w-8 h-8 rounded-full border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
        {renderActionBtn()}
      </div>
      <TipJarModal isOpen={showTipJar} onClose={() => setShowTipJar(false)} documentTitle={title} />
    </>
  );
}

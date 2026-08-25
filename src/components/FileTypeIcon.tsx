'use client';

import { FileTextIcon, FileIcon, MonitorIcon, FileCode2Icon, ArchiveIcon } from "lucide-react";

export function FileTypeIcon({ filename, className = "w-10 h-10 rounded shrink-0 flex items-center justify-center" }: { filename: string, className?: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf') {
    return (
      <div className={`${className} bg-[#FEE2E2] text-[#B91C1C]`}>
        <FileTextIcon className="w-5 h-5" />
      </div>
    );
  }
  
  if (ext === 'doc' || ext === 'docx') {
    return (
      <div className={`${className} bg-[#DBEAFE] text-[#1D4ED8]`}>
        <FileTextIcon className="w-5 h-5" />
      </div>
    );
  }

  if (ext === 'ppt' || ext === 'pptx') {
    return (
      <div className={`${className} bg-[#FFEDD5] text-[#C2410C]`}>
        <MonitorIcon className="w-5 h-5" />
      </div>
    );
  }

  if (ext === 'zip' || ext === 'rar') {
    return (
      <div className={`${className} bg-[#F3E8FF] text-[#6D28D9]`}>
        <ArchiveIcon className="w-5 h-5" />
      </div>
    );
  }

  // Default fallback
  return (
    <div className={`${className} bg-[var(--paper-deep)] text-[var(--ink-soft)]`}>
      <FileIcon className="w-5 h-5" />
    </div>
  );
}

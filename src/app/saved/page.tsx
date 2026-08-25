'use client';

import { useState, useEffect } from "react";
import { TrashIcon, AlertCircleIcon, SearchIcon } from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { useRouter } from "next/navigation";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import Link from "next/link";

export default function Saved() {
  const [files, setFiles] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const saved = await OfflineManager.getDownloadedFiles();
      setFiles(saved);
    } catch (e) {
      console.error(e);
    }
  };

  const removeFile = async (e: React.MouseEvent, contentId: string) => {
    e.stopPropagation(); // prevent opening the file
    if (confirm("Remove this saved file?")) {
      try {
        await OfflineManager.deleteFile(contentId);
        loadFiles(); // reload
      } catch (err) {
        alert("Failed to delete file.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--paper)]">
      <div className="px-[18px] py-4 border-b border-[var(--rule)] bg-[var(--paper-card)] sticky top-0 z-10">
        <h1 className="font-bold text-[20px] leading-tight text-[var(--ink)]">Saved Offline</h1>
        <p className="text-[12px] text-[var(--ink-soft)] mt-1">Files downloaded for offline reading</p>
      </div>

      <div className="px-[18px] py-6 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-6 bg-[var(--paper)] flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] flex items-center justify-center">
              <SearchIcon className="w-5 h-5 text-[var(--ink-soft)]" />
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-[var(--ink)]">No offline files</p>
              <p className="text-[11.5px] text-[var(--ink-soft)] mt-1 max-w-[220px] mx-auto">You haven't downloaded any notes or PYQs yet.</p>
            </div>
            <Link href="/browse" className="mt-2 bg-[var(--ink)] text-[var(--paper)] text-[12px] font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Explore Subjects
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {files.map((file) => {
              // Split logic for clean title (e.g. "Big Data - Unit 1")
              const parts = file.title.split(' - ');
              const displaySubject = parts.length > 1 ? parts[0] : 'Subject';
              const displayUnit = parts.length > 1 ? parts.slice(1).join(' - ') : file.title;
              
              return (
                <div 
                  key={file.contentId} 
                  className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center cursor-pointer hover:bg-[var(--paper-deep)] transition-colors group shadow-sm"
                  onClick={() => OfflineManager.openNativeFile(file.contentId, file.fileUrl)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileTypeIcon filename={file.fileUrl} className="w-10 h-10 rounded flex items-center justify-center shrink-0 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[13.5px] text-[var(--ink)] truncate">{displaySubject}</div>
                      <div className="font-semibold text-[11.5px] text-[var(--ink-soft)] truncate mt-0.5">{displayUnit}</div>
                      <div className="font-mono text-[10px] text-[var(--ink-faint)] mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Offline • {file.sizeKb ? `${(file.sizeKb / 1024).toFixed(1)} MB` : 'Unknown size'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => removeFile(e, file.contentId)}
                    className="p-2.5 text-[var(--ink-faint)] hover:text-[var(--red)] transition-colors hover:bg-[var(--red-bg)] rounded-lg shrink-0"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from "react";
import { FileTextIcon, TrashIcon, AlertCircleIcon } from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { useRouter } from "next/navigation";

export default function Saved() {
  const [files, setFiles] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = () => {
    const downloaded = OfflineManager.getDownloadedFiles();
    setFiles(downloaded.sort((a: any, b: any) => b.downloadedAt - a.downloadedAt));
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    await OfflineManager.deleteFile(filename);
    loadFiles();
  };

  const handleOpen = (filename: string, title: string) => {
    router.push(`/read?file=${encodeURIComponent(filename)}&title=${encodeURIComponent(title)}`);
  };

  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col">
      <h1 className="font-bold text-[19px] mb-4">Saved Offline</h1>

      <div className="flex flex-col gap-3">
        {files.length > 0 ? (
          files.map((file, i) => (
            <div 
              key={i} 
              onClick={() => handleOpen(file.filename, file.title)}
              className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-2.5 cursor-pointer hover:bg-[var(--paper-deep)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[var(--red-bg)] text-[var(--red)] flex items-center justify-center shrink-0">
                  <FileTextIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13.5px]">{file.title.replace(/^null\s/, '')}</div>
                  <div className="font-mono text-[10.5px] text-[var(--ink-soft)] mt-0.5">
                    Available Offline · {file.sizeKb ? `${(file.sizeKb / 1024).toFixed(1)} MB` : 'Unknown size'}
                  </div>
                </div>
              </div>
              <button 
                onClick={(e) => handleDelete(e, file.filename)}
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 text-[var(--ink-faint)] hover:bg-[var(--red-bg)] hover:text-[var(--red)] transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-6 bg-[var(--paper)] flex flex-col items-center justify-center text-center gap-2 mt-4">
            <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] flex items-center justify-center">
              <AlertCircleIcon className="w-5 h-5 text-[var(--ink-soft)]" />
            </div>
            <p className="text-[13px] font-medium text-[var(--ink-soft)]">No saved notes</p>
            <p className="text-[11px] text-[var(--ink-faint)] max-w-[200px]">Notes you download will appear here so you can read them without internet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

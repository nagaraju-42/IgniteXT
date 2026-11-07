'use client';

import { useState, useEffect } from "react";
import { 
  FileTextIcon, 
  TrashIcon, 
  AlertCircleIcon, 
  ExternalLinkIcon, 
  FolderIcon, 
  ChevronDownIcon 
} from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { useRouter } from "next/navigation";

export default function Saved() {
  const [files, setFiles] = useState<any[]>([]);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    loadFiles();

    const handleSync = () => loadFiles();
    window.addEventListener('offline_files_changed', handleSync);
    return () => window.removeEventListener('offline_files_changed', handleSync);
  }, []);

  const loadFiles = async () => {
    const downloaded = await (OfflineManager as any).syncAndGetFiles();
    setFiles(downloaded.sort((a: any, b: any) => (b.downloadedAt || 0) - (a.downloadedAt || 0)));
  };

  const toggleFolder = (subjectName: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [subjectName]: prev[subjectName] === false ? true : false
    }));
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    await OfflineManager.deleteFile(filename);
    loadFiles();
  };

  const handleOpenExternal = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { FileOpener } = await import('@capacitor-community/file-opener');
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        const { uri } = await Filesystem.getUri({
          path: `pdf_cache/${filename}`,
          directory: Directory.Data
        });
        await FileOpener.open({ filePath: uri });
      } else {
        const uri = await OfflineManager.getOfflineFileDataUri(filename);
        if (uri) window.open(uri, '_blank');
      }
    } catch (err) {
      console.error(err);
      alert("Could not open in external app. Please ensure a PDF reader is installed.");
    }
  };

  const handleOpen = async (filename: string, title: string) => {
    try {
      const isPdf = filename.toLowerCase().endsWith('.pdf');
      
      // If it's a PDF, open it inside our in-app reader!
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
      } else {
        const uri = await OfflineManager.getOfflineFileDataUri(filename);
        if (uri) window.open(uri, '_blank');
      }
    } catch (error) {
      console.log('Failed to open file:', error);
      alert("Could not open this file type on your device. Please install a PDF or Word Viewer.");
    }
  };

  // Group downloaded files by Full Official Subject Name
  const groupedFiles: Record<string, any[]> = {};
  files.forEach(file => {
    let subj = (file.subjectName || '').trim();
    if (!subj || subj === 'General Notes') {
      const resolved = (OfflineManager as any).resolveSubjectAndTitle(file.filename, file.title, file.subjectName);
      subj = resolved.subjectName;
      file.title = resolved.title;
    }
    subj = subj || 'General Notes';
    if (!groupedFiles[subj]) groupedFiles[subj] = [];
    groupedFiles[subj].push(file);
  });

  const subjectList = Object.keys(groupedFiles);

  return (
    <div className="px-[18px] pt-4 pb-12 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-[20px] text-[var(--ink)]">Saved Offline</h1>
          <p className="text-[11.5px] text-[var(--ink-soft)] mt-0.5">
            Organized by subject folders · Read anytime without internet
          </p>
        </div>
        {files.length > 0 && (
          <span className="font-mono text-[11px] font-bold bg-[var(--ink)] text-[var(--paper)] px-2.5 py-1 rounded-full">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {subjectList.length > 0 ? (
          subjectList.map((subjectName) => {
            const subjectNotes = groupedFiles[subjectName];
            // Folders open by default unless toggled closed
            const isOpen = openFolders[subjectName] !== false;

            return (
              <div 
                key={subjectName}
                className="border-[2px] border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] overflow-hidden transition-all"
              >
                {/* Folder Header Box */}
                <button
                  type="button"
                  onClick={() => toggleFolder(subjectName)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--paper-deep)] transition-colors cursor-pointer select-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-xl bg-[#D7E600] border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center shrink-0">
                      <FolderIcon className="w-5 h-5 text-[var(--ink)]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-[15px] text-[var(--ink)] leading-tight truncate">
                        {subjectName}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] font-bold bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-full">
                          {subjectNotes.length} {subjectNotes.length === 1 ? 'Note' : 'Notes'}
                        </span>
                        <span className="text-[11px] text-[var(--ink-soft)] font-medium">
                          {isOpen ? 'Tap to close folder' : 'Tap to open folder'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-[var(--paper)] border border-[var(--rule-strong)] flex items-center justify-center shrink-0 text-[var(--ink)]">
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Folder Contents: Downloaded PDFs inside this subject */}
                {isOpen && (
                  <div className="p-3.5 pt-1 border-t-[1.5px] border-[var(--rule-strong)] bg-[var(--paper)] flex flex-col gap-2.5 animate-in fade-in duration-200">
                    {subjectNotes.map((file, i) => (
                      <div 
                        key={file.filename || i} 
                        onClick={() => handleOpen(file.filename, file.title)}
                        className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3 bg-[var(--paper-card)] flex justify-between items-center gap-3 cursor-pointer hover:border-[var(--ink)] shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-[var(--paper-deep)] border border-[var(--rule-strong)] flex items-center justify-center shrink-0 shadow-sm text-[var(--ink)]">
                            <FileTextIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[13px] leading-snug break-words text-[var(--ink)]">
                              {file.title && subjectName && file.title.toLowerCase().startsWith(subjectName.toLowerCase() + ' - ')
                                ? file.title.substring(subjectName.length + 3).trim()
                                : file.title}
                            </div>
                            <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Saved Offline
                              </span>
                              {file.sizeKb && file.sizeKb > 0 ? (
                                <span>· {(file.sizeKb / 1024).toFixed(1)} MB</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Open in Other Apps & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button 
                            onClick={(e) => handleOpenExternal(e, file.filename)}
                            className="px-2 py-1.5 rounded-lg border border-[var(--rule-strong)] bg-[var(--paper-deep)] hover:bg-[var(--paper)] text-[var(--ink)] font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
                            title="Open in other apps (Adobe, Drive, etc.)"
                          >
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Other Apps</span>
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, file.filename)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-faint)] hover:bg-[var(--red-bg)] hover:text-[var(--red)] transition-colors cursor-pointer"
                            title="Delete file"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-2xl p-8 bg-[var(--paper)] flex flex-col items-center justify-center text-center gap-2 mt-4">
            <div className="w-12 h-12 rounded-full bg-[var(--paper-deep)] flex items-center justify-center">
              <AlertCircleIcon className="w-6 h-6 text-[var(--ink-soft)]" />
            </div>
            <p className="font-bold text-[14px] text-[var(--ink)]">No saved offline notes yet</p>
            <p className="text-[11.5px] text-[var(--ink-soft)] max-w-[240px] leading-relaxed">
              When you download notes on subject pages, they will appear here organized neatly in folders by subject.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

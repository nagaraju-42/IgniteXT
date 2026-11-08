'use client';

import { useState, useEffect, useMemo } from "react";
import { 
  FileTextIcon, 
  TrashIcon, 
  AlertCircleIcon, 
  ExternalLinkIcon, 
  FolderIcon, 
  ChevronRightIcon,
  ChevronLeftIcon,
  GraduationCapIcon,
  BookOpenIcon,
  HardDriveIcon,
  ArrowLeftIcon
} from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { useRouter } from "next/navigation";

interface SavedFileItem {
  filename: string;
  title: string;
  subjectName?: string;
  sizeKb?: number;
  downloadedAt?: number;
  isPyq?: boolean;
}

export default function Saved() {
  const [files, setFiles] = useState<SavedFileItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'notes' | 'pyq'>('notes');
  const router = useRouter();

  useEffect(() => {
    // 1. Instantly display downloaded files from local storage with 0ms delay
    const immediate = (OfflineManager as any).getDownloadedFiles();
    if (immediate && immediate.length > 0) {
      setFiles(immediate.sort((a: any, b: any) => (b.downloadedAt || 0) - (a.downloadedAt || 0)));
    }

    // 2. Background sync
    loadFiles();

    const handleSync = () => loadFiles();
    window.addEventListener('offline_files_changed', handleSync);
    return () => window.removeEventListener('offline_files_changed', handleSync);
  }, []);

  // Handle native Android back button navigation between folders and sub-views
  useEffect(() => {
    const handlePopState = () => {
      if (viewMode === 'pyq') {
        setViewMode('notes');
      } else if (selectedSubject) {
        setSelectedSubject(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSubject, viewMode]);

  const loadFiles = async () => {
    const downloaded = await (OfflineManager as any).syncAndGetFiles();
    setFiles(downloaded.sort((a: any, b: any) => (b.downloadedAt || 0) - (a.downloadedAt || 0)));
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (confirm("Delete this offline file?")) {
      await OfflineManager.deleteFile(filename);
      loadFiles();
    }
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
      alert("Could not open in external app. Please ensure a PDF reader (Adobe, Drive, WPS) is installed.");
    }
  };

  const handleOpenInApp = async (filename: string, title: string) => {
    try {
      const isPdf = filename.toLowerCase().endsWith('.pdf');
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
      alert("Could not open this file type on your device. Please install a PDF Viewer.");
    }
  };

  // Helper to determine if a file is a PYQ
  const isPyqFile = (file: SavedFileItem): boolean => {
    if (file.isPyq === true) return true;
    const t = (file.title || '').toLowerCase();
    const fn = (file.filename || '').toLowerCase();
    return (
      t.includes('pyq') || 
      fn.includes('pyq') || 
      t.includes('question paper') || 
      fn.includes('question paper') ||
      t.includes('mid paper') || 
      t.includes('mid exam') || 
      /\b20[2-3][0-9]\b/.test(t)
    );
  };

  // Helper to sanitize messy UUIDs and titles
  const cleanDisplayTitle = (rawTitle: string, subjectName?: string): string => {
    let title = (rawTitle || '').replace(/^null\s+/, '').trim();
    // Strip raw UUID prefixes (both hyphenated and space-separated)
    title = title.replace(/^[0-9a-f]{8}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{2,12}[-\s]?/i, '');
    title = title.replace(/^[0-9a-f]{8,36}[-\s]?/i, '');
    title = title.replace(/\.(pdf|docx?|pptx?)$/i, '');
    title = decodeURIComponent(title).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

    // Strip redundant subject name prefix
    if (subjectName) {
      const sLower = subjectName.toLowerCase();
      if (title.toLowerCase().startsWith(sLower + ' - ')) {
        title = title.substring(subjectName.length + 3).trim();
      } else if (title.toLowerCase().startsWith(sLower)) {
        const rest = title.substring(subjectName.length).replace(/^[-:\s]+/, '').trim();
        if (rest.length > 2) title = rest;
      }
    }

    if (/^20[2-3][0-9]$/.test(title)) {
      return `${title} Question Paper (PYQ)`;
    }
    if (/^unit\s*[1-5]$/i.test(title)) {
      return `${title.toUpperCase()} Lecture Notes`;
    }

    return title || 'Study Material';
  };

  // Group downloaded files by Subject Name
  const groupedData = useMemo(() => {
    const map: Record<string, { notes: SavedFileItem[]; pyqs: SavedFileItem[]; totalSizeKb: number }> = {};
    
    files.forEach(file => {
      let subj = (file.subjectName || '').trim();
      if (!subj || subj === 'General Notes') {
        const resolved = (OfflineManager as any).resolveSubjectAndTitle(file.filename, file.title, file.subjectName);
        subj = resolved.subjectName;
        file.title = resolved.title;
      }
      subj = subj || 'General Notes';

      if (!map[subj]) {
        map[subj] = { notes: [], pyqs: [], totalSizeKb: 0 };
      }

      if (isPyqFile(file)) {
        map[subj].pyqs.push(file);
      } else {
        map[subj].notes.push(file);
      }
      map[subj].totalSizeKb += file.sizeKb || 0;
    });

    return map;
  }, [files]);

  const subjectNames = Object.keys(groupedData);

  // Calculate total app storage across all offline files
  const totalStorageMb = useMemo(() => {
    const totalKb = files.reduce((acc, f) => acc + (f.sizeKb || 0), 0);
    return (totalKb / 1024).toFixed(1);
  }, [files]);

  // Navigate into a subject folder
  const handleOpenSubjectFolder = (subjectName: string) => {
    window.history.pushState({ folder: subjectName }, '');
    setSelectedSubject(subjectName);
    setViewMode('notes');
  };

  // Navigate back to all subject folders
  const handleBackToAllFolders = () => {
    setSelectedSubject(null);
    setViewMode('notes');
  };

  // Navigate into PYQs folder inside a subject
  const handleOpenPyqFolder = () => {
    window.history.pushState({ pyq: true }, '');
    setViewMode('pyq');
  };

  // Navigate back from PYQ folder to subject notes
  const handleBackToSubjectNotes = () => {
    setViewMode('notes');
  };

  // =========================================================================
  // VIEW 3: Inside PYQ Sub-Folder
  // =========================================================================
  if (selectedSubject && viewMode === 'pyq') {
    const currentSubjectData = groupedData[selectedSubject] || { notes: [], pyqs: [], totalSizeKb: 0 };
    const pyqList = currentSubjectData.pyqs;

    return (
      <div className="px-[18px] pt-4 pb-16 min-h-full flex flex-col bg-[var(--paper)]">
        {/* Top Header Bar */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={handleBackToSubjectNotes}
            className="w-9 h-9 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper-card)] flex items-center justify-center text-[var(--ink)] active:scale-95 transition-transform shadow-[2px_2px_0_var(--ink)] cursor-pointer"
            aria-label="Back to Subject"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-bold">
              {selectedSubject}
            </span>
            <h1 className="font-bold text-[18px] text-[var(--ink)] leading-tight truncate">
              Previous Year Papers (PYQ)
            </h1>
          </div>
          <span className="font-mono text-[11px] font-bold bg-[#D7E600] border-[1.5px] border-[var(--ink)] text-[var(--ink)] px-2.5 py-1 rounded-full shadow-[2px_2px_0_var(--ink)] shrink-0">
            {pyqList.length} {pyqList.length === 1 ? 'Paper' : 'Papers'}
          </span>
        </div>

        {/* PYQ Papers List */}
        <div className="flex flex-col gap-3">
          {pyqList.length > 0 ? (
            pyqList.map((file, idx) => {
              const displayTitle = cleanDisplayTitle(file.title, selectedSubject);
              return (
                <div
                  key={file.filename || idx}
                  onClick={() => handleOpenInApp(file.filename, displayTitle)}
                  className="border-[1.5px] border-[var(--ink)] rounded-2xl p-3.5 bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all hover:bg-[var(--paper-deep)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 shadow-[2px_2px_0_var(--ink)] text-purple-900">
                      <GraduationCapIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[14px] text-[var(--ink)] leading-snug line-clamp-2">
                        {displayTitle}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Offline Ready
                        </span>
                        {file.sizeKb && file.sizeKb > 0 ? (
                          <span className="font-mono text-[10px] text-[var(--ink-soft)] font-medium">
                            · {(file.sizeKb / 1024).toFixed(1)} MB
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Open in External App & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenExternal(e, file.filename)}
                      className="px-2.5 py-1.5 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper)] hover:bg-[#D7E600] text-[var(--ink)] font-bold text-[11px] flex items-center gap-1 shadow-[2px_2px_0_var(--ink)] active:scale-95 transition-all cursor-pointer"
                      title="Open in Adobe Acrobat, Google Drive, WPS"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">Other Apps</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, file.filename)}
                      className="w-8 h-8 rounded-xl border border-[var(--rule-strong)] hover:border-[var(--red)] flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--red)] hover:bg-[var(--red-bg)] transition-colors cursor-pointer"
                      title="Delete question paper"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="border-[2px] border-dashed border-[var(--rule-strong)] rounded-2xl p-8 bg-[var(--paper-card)] flex flex-col items-center justify-center text-center gap-2 mt-4">
              <div className="w-12 h-12 rounded-full bg-[var(--paper-deep)] flex items-center justify-center text-[var(--ink-soft)]">
                <AlertCircleIcon className="w-6 h-6" />
              </div>
              <p className="font-bold text-[14px] text-[var(--ink)]">No PYQs saved yet</p>
              <p className="text-[11.5px] text-[var(--ink-soft)] max-w-[240px]">
                Download past papers from the subject page to read them offline here.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Inside Subject Folder (Lecture Notes + Top PYQ Folder)
  // =========================================================================
  if (selectedSubject && viewMode === 'notes') {
    const currentSubjectData = groupedData[selectedSubject] || { notes: [], pyqs: [], totalSizeKb: 0 };
    const notesList = currentSubjectData.notes;
    const pyqList = currentSubjectData.pyqs;

    return (
      <div className="px-[18px] pt-4 pb-16 min-h-full flex flex-col bg-[var(--paper)]">
        {/* Top Header Bar */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={handleBackToAllFolders}
            className="w-9 h-9 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper-card)] flex items-center justify-center text-[var(--ink)] active:scale-95 transition-transform shadow-[2px_2px_0_var(--ink)] cursor-pointer"
            aria-label="Back to all folders"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-bold">
              Subject Folder
            </span>
            <h1 className="font-bold text-[18px] text-[var(--ink)] leading-tight truncate">
              {selectedSubject}
            </h1>
          </div>
          <span className="font-mono text-[11px] font-bold bg-[var(--ink)] text-[var(--paper)] px-2.5 py-1 rounded-full shrink-0">
            {notesList.length + pyqList.length} files
          </span>
        </div>

        {/* 1. TOP PYQ FOLDER CARD */}
        <div 
          onClick={handleOpenPyqFolder}
          className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-gradient-to-r from-purple-50 to-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] mb-5 cursor-pointer active:scale-[0.99] transition-all hover:bg-purple-100/50 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-purple-200 border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center shrink-0 text-purple-900">
              <GraduationCapIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[15px] text-[var(--ink)] leading-tight">
                  Previous Year Papers (PYQ)
                </h2>
                <span className="font-mono text-[10px] font-bold bg-purple-700 text-white px-2 py-0.5 rounded-full">
                  Folder
                </span>
              </div>
              <p className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5">
                {pyqList.length > 0 
                  ? `${pyqList.length} ${pyqList.length === 1 ? 'Paper' : 'Papers'} saved offline · Tap to open`
                  : 'Tap to view past papers folder'}
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-[var(--paper)] border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
            <ChevronRightIcon className="w-4 h-4" />
          </div>
        </div>

        {/* 2. LECTURE NOTES HEADER */}
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-4 h-4 text-[var(--ink)]" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]">
              Lecture Notes ({notesList.length})
            </span>
          </div>
          <span className="text-[11px] text-[var(--ink-soft)] font-medium">
            Tap card to read
          </span>
        </div>

        {/* 3. LECTURE NOTES LIST */}
        <div className="flex flex-col gap-3">
          {notesList.length > 0 ? (
            notesList.map((file, idx) => {
              const displayTitle = cleanDisplayTitle(file.title, selectedSubject);
              return (
                <div
                  key={file.filename || idx}
                  onClick={() => handleOpenInApp(file.filename, displayTitle)}
                  className="border-[1.5px] border-[var(--ink)] rounded-2xl p-3.5 bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all hover:bg-[var(--paper-deep)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#D7E600] border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 shadow-[2px_2px_0_var(--ink)] text-[var(--ink)]">
                      <FileTextIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[14px] text-[var(--ink)] leading-snug line-clamp-2">
                        {displayTitle}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Offline Ready
                        </span>
                        {file.sizeKb && file.sizeKb > 0 ? (
                          <span className="font-mono text-[10px] text-[var(--ink-soft)] font-medium">
                            · {(file.sizeKb / 1024).toFixed(1)} MB
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Open in External App & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenExternal(e, file.filename)}
                      className="px-2.5 py-1.5 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper)] hover:bg-[#D7E600] text-[var(--ink)] font-bold text-[11px] flex items-center gap-1 shadow-[2px_2px_0_var(--ink)] active:scale-95 transition-all cursor-pointer"
                      title="Open in Adobe Acrobat, Google Drive, WPS"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">Other Apps</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, file.filename)}
                      className="w-8 h-8 rounded-xl border border-[var(--rule-strong)] hover:border-[var(--red)] flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--red)] hover:bg-[var(--red-bg)] transition-colors cursor-pointer"
                      title="Delete note"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="border-[2px] border-dashed border-[var(--rule-strong)] rounded-2xl p-8 bg-[var(--paper-card)] flex flex-col items-center justify-center text-center gap-2 mt-2">
              <div className="w-12 h-12 rounded-full bg-[var(--paper-deep)] flex items-center justify-center text-[var(--ink-soft)]">
                <AlertCircleIcon className="w-6 h-6" />
              </div>
              <p className="font-bold text-[14px] text-[var(--ink)]">No lecture notes saved yet</p>
              <p className="text-[11.5px] text-[var(--ink-soft)] max-w-[240px]">
                Download notes for this subject to read them offline here.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: Main Screen — Subject Folders Only (No Accordions, No Clutter!)
  // =========================================================================
  return (
    <div className="px-[18px] pt-4 pb-16 min-h-full flex flex-col bg-[var(--paper)]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-[22px] text-[var(--ink)] leading-tight">Saved Offline</h1>
          <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
            Organized by subject folders · Read anytime without internet
          </p>
        </div>
        {files.length > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold bg-[var(--ink)] text-[var(--paper)] px-3 py-1.5 rounded-full shadow-[2px_2px_0_var(--ink)]">
            <HardDriveIcon className="w-3 h-3 text-[#D7E600]" />
            <span>{totalStorageMb} MB</span>
          </div>
        )}
      </div>

      {/* Subject Folders List */}
      <div className="flex flex-col gap-3.5">
        {subjectNames.length > 0 ? (
          subjectNames.map((subjectName) => {
            const subjectData = groupedData[subjectName];
            const notesCount = subjectData.notes.length;
            const pyqsCount = subjectData.pyqs.length;
            const totalCount = notesCount + pyqsCount;
            const sizeMb = (subjectData.totalSizeKb / 1024).toFixed(1);

            return (
              <div
                key={subjectName}
                onClick={() => handleOpenSubjectFolder(subjectName)}
                className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all hover:bg-[var(--paper-deep)]"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Folder Icon Badge */}
                  <div className="w-12 h-12 rounded-2xl bg-[#D7E600] border-[2px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center shrink-0 text-[var(--ink)]">
                    <FolderIcon className="w-6 h-6 fill-[#D7E600]" />
                  </div>

                  {/* Folder Info */}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-[16px] text-[var(--ink)] leading-snug line-clamp-1">
                      {subjectName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="font-mono text-[10px] font-bold bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-full">
                        {notesCount} {notesCount === 1 ? 'Note' : 'Notes'}
                      </span>
                      {pyqsCount > 0 && (
                        <span className="font-mono text-[10px] font-bold bg-purple-700 text-white px-2 py-0.5 rounded-full">
                          {pyqsCount} {pyqsCount === 1 ? 'PYQ' : 'PYQs'}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-[var(--ink-soft)] font-medium">
                        · {sizeMb} MB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-9 h-9 rounded-xl bg-[var(--paper)] border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
                  <ChevronRightIcon className="w-5 h-5" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="border-[2px] border-dashed border-[var(--rule-strong)] rounded-2xl p-8 bg-[var(--paper-card)] flex flex-col items-center justify-center text-center gap-3 mt-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D7E600]/20 border border-[var(--ink)] flex items-center justify-center text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
              <FolderIcon className="w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-[15px] text-[var(--ink)]">No offline folders yet</p>
              <p className="text-[12px] text-[var(--ink-soft)] max-w-[260px] mt-1 leading-relaxed">
                When you download lecture notes and question papers, they will be organized here cleanly into subject folders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-2 px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--paper)] font-bold text-[12px] shadow-[2px_2px_0_var(--ink)] active:scale-95 transition-transform"
            >
              Browse Subjects
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

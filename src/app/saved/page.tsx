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
  HardDriveIcon,
  PlayIcon
} from "lucide-react";
import { OfflineManager } from "@/lib/offlineManager";
import { useRouter } from "next/navigation";
import { deriveSubjectShortCode } from "@/lib/subjectNaming";
import { useIsNativeApp } from "@/lib/useIsNativeApp";
import { WebSaved } from "@/components/web/WebSaved";

interface SavedFileItem {
  filename: string;
  title: string;
  subjectName?: string;
  sizeKb?: number;
  downloadedAt?: number;
  isPyq?: boolean;
  unitNumber?: number | null;
}

export default function Saved() {
  const nativeMode = useIsNativeApp();
  return nativeMode ? <ApkSaved /> : <WebSaved />;
}

function ApkSaved() {
  const [files, setFiles] = useState<SavedFileItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'notes' | 'pyq'>('all');
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
    window.addEventListener('offline_file_deleted', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('offline_files_changed', handleSync);
      window.removeEventListener('offline_file_deleted', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Handle native Android back button navigation between folders and sub-views
  useEffect(() => {
    const handlePopState = () => {
      if (selectedSubject) {
        setSelectedSubject(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSubject]);

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

  const handleOpenInApp = (filename: string, title: string) => {
    router.push(`/read?file=${encodeURIComponent(filename)}&title=${encodeURIComponent(title)}`);
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

  // Extract Unit number from file title or filename (e.g. Unit 1, Unit-1-2 -> 1)
  const extractUnitNumber = (file: SavedFileItem): number => {
    if (file.unitNumber && typeof file.unitNumber === 'number') return file.unitNumber;
    const combined = `${file.title} ${file.filename}`.toLowerCase();
    const match = combined.match(/unit[-_\s]*([1-5])/i);
    return match ? parseInt(match[1]) : 1;
  };

  // Helper to ensure clean auto-sequential title: e.g. CIS Unit-1-1, DSV Unit-2-1, FBT PYQ-1
  const formatBentoTitle = (file: SavedFileItem, subjectName: string, seqIdx: number): string => {
    let title = (file.title || '').trim();
    const shortCode = deriveSubjectShortCode(subjectName);

    // If title is already in clean sequential format (e.g. CIS Unit-1-1 or CIS PYQ-1), keep it!
    if (/^[A-Z0-9]{2,6}(\s+Lab)?\s+(Unit-\d+-\d+|PYQ-\d+|IMP-\d+)/i.test(title)) {
      return title;
    }

    const isPyq = isPyqFile(file);
    if (isPyq) {
      const yearMatch = title.match(/\b(20[2-3][0-9])\b/);
      if (yearMatch) {
        return `${shortCode} PYQ-${yearMatch[1]}`;
      }
      return `${shortCode} PYQ-${seqIdx + 1}`;
    }

    const unitNum = extractUnitNumber(file);
    return `${shortCode} Unit-${unitNum}-${seqIdx + 1}`;
  };

  // Group downloaded files by Subject Name
  const groupedData = useMemo(() => {
    const map: Record<string, { notes: SavedFileItem[]; pyqs: SavedFileItem[]; all: SavedFileItem[]; totalSizeKb: number }> = {};
    
    files.forEach(file => {
      let subj = (file.subjectName || '').trim();
      if (!subj || subj === 'General Notes') {
        const resolved = (OfflineManager as any).resolveSubjectAndTitle(file.filename, file.title, file.subjectName);
        subj = resolved.subjectName;
        file.title = resolved.title;
      }
      subj = subj || 'General Notes';

      if (!map[subj]) {
        map[subj] = { notes: [], pyqs: [], all: [], totalSizeKb: 0 };
      }

      map[subj].all.push(file);

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

  // Total offline storage calculation
  const totalStorageMb = useMemo(() => {
    const totalKb = files.reduce((acc, f) => acc + (f.sizeKb || 0), 0);
    return (totalKb / 1024).toFixed(1);
  }, [files]);

  // Navigate into a subject folder
  const handleOpenSubjectFolder = (subjectName: string) => {
    window.history.pushState({ folder: subjectName }, '');
    setSelectedSubject(subjectName);
    setActiveFilter('all');
  };

  // Navigate back to all subject folders
  const handleBackToAllFolders = () => {
    setSelectedSubject(null);
    setActiveFilter('all');
  };

  // =========================================================================
  // VIEW 2: Subject Detail Screen — 2-Column Bento Grid (#EFECE1 / #1C1B17 / #C8E600)
  // =========================================================================
  if (selectedSubject) {
    const currentSubjectData = groupedData[selectedSubject] || { notes: [], pyqs: [], all: [], totalSizeKb: 0 };
    const notesList = currentSubjectData.notes;
    const pyqList = currentSubjectData.pyqs;
    const allList = currentSubjectData.all;

    // Filter items based on active pill
    const displayedItems = activeFilter === 'notes' 
      ? notesList 
      : activeFilter === 'pyq' 
      ? pyqList 
      : allList;

    const shortCode = deriveSubjectShortCode(selectedSubject);

    return (
      <div className="px-[16px] pt-4 pb-20 min-h-screen flex flex-col bg-[#EFECE1]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBackToAllFolders}
              className="w-9 h-9 rounded-xl border-[2px] border-[#1C1B17] bg-white flex items-center justify-center text-[#1C1B17] active:scale-95 transition-transform shadow-[2px_2px_0_#1C1B17] cursor-pointer shrink-0"
              aria-label="Back to all folders"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-[#C8E600] text-[#1C1B17] px-2 py-0.5 rounded border border-[#1C1B17]">
                  {shortCode}
                </span>
                <span className="font-mono text-[10.5px] text-[#1C1B17]/70 font-bold">
                  {allList.length} {allList.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              <h1 className="font-black text-[18px] text-[#1C1B17] leading-tight truncate mt-0.5">
                {selectedSubject}
              </h1>
            </div>
          </div>
        </div>

        {/* 2. HORIZONTAL SEGMENTED PILL FILTER BAR */}
        <div className="flex items-center gap-2 py-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: `All (${allList.length})` },
            { id: 'notes', label: `Unit Notes (${notesList.length})` },
            { id: 'pyq', label: `PYQs (${pyqList.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === tab.id
                  ? 'bg-[#1C1B17] text-[#C8E600] border-[2px] border-[#1C1B17] shadow-[2px_2px_0_#1C1B17]'
                  : 'bg-[#FAF9F5] text-[#1C1B17]/80 border-[1.5px] border-[#1C1B17]/30 hover:border-[#1C1B17]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. TWO-COLUMN BENTO GRID */}
        {displayedItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 mt-1">
            {displayedItems.map((file, idx) => {
              const isPyq = isPyqFile(file);
              const unitNum = extractUnitNumber(file);
              const autoTitle = formatBentoTitle(file, selectedSubject, idx);
              const sizeMb = file.sizeKb && file.sizeKb > 0 ? (file.sizeKb / 1024).toFixed(1) : '1.3';

              const unitBadgeLabel = isPyq 
                ? (file.title.match(/\b(20[2-3][0-9])\b/)?.[1] ? `PYQ ${file.title.match(/\b(20[2-3][0-9])\b/)?.[1]}` : 'PYQ')
                : `UNIT ${unitNum}`;

              const isFeaturedUnit = unitNum === 1;

              return (
                <div
                  key={file.filename || idx}
                  className="border-[2px] border-[#1C1B17] rounded-2xl bg-[#FAF9F5] p-3.5 shadow-[3px_3px_0_#1C1B17] flex flex-col justify-between min-h-[175px] hover:translate-y-[-1px] transition-all relative overflow-hidden"
                >
                  {/* Top Row: Unit Pill Badge (left) & Action Buttons (right) */}
                  <div className="flex items-center justify-between gap-1 w-full">
                    {/* Dark Unit Pill Badge */}
                    <span className={`font-mono text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#1C1B17] ${
                      isFeaturedUnit 
                        ? 'bg-[#1C1B17] text-[#C8E600]' 
                        : isPyq 
                        ? 'bg-purple-950 text-purple-200' 
                        : 'bg-[#1C1B17] text-white'
                    }`}>
                      {unitBadgeLabel}
                    </span>

                    {/* Compact Top-Right Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenExternal(e, file.filename)}
                        className="w-6 h-6 rounded-lg border border-[#1C1B17] bg-[#EFECE1] hover:bg-[#C8E600] flex items-center justify-center text-[#1C1B17] transition-all cursor-pointer active:scale-90"
                        title="Open in Adobe Acrobat, Google Drive, WPS"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, file.filename)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[#1C1B17]/40 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer active:scale-90"
                        title="Delete note"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Middle: Bold Auto-Generated Title + MB Size (NO 'Offline Ready' badge!) */}
                  <div className="my-2 min-w-0">
                    <h3 className="font-black text-[13.5px] text-[#1C1B17] leading-snug line-clamp-2">
                      {autoTitle}
                    </h3>
                    <div className="font-mono text-[11px] text-[#1C1B17]/70 font-semibold mt-1">
                      {sizeMb} MB
                    </div>
                  </div>

                  {/* Bottom: Full-Width Electric Lime Pill Button (▶ Read PDF) */}
                  <button
                    type="button"
                    onClick={() => handleOpenInApp(file.filename, autoTitle)}
                    className="w-full bg-[#C8E600] hover:bg-[#bfe000] text-[#1C1B17] border-[1.5px] border-[#1C1B17] font-black text-[11px] py-2 rounded-xl shadow-[2px_2px_0_#1C1B17] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <PlayIcon className="w-3 h-3 fill-[#1C1B17]" />
                    <span>Read PDF</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-[2px] border-dashed border-[#1C1B17]/40 rounded-2xl p-8 bg-white/70 flex flex-col items-center justify-center text-center gap-2 mt-4 shadow-xs">
            <AlertCircleIcon className="w-8 h-8 text-[#1C1B17]/50" />
            <p className="font-bold text-[14px] text-[#1C1B17]">
              No {activeFilter === 'notes' ? 'lecture notes' : activeFilter === 'pyq' ? 'PYQ papers' : 'files'} saved yet
            </p>
            <p className="text-[11.5px] text-[#1C1B17]/70 max-w-[220px]">
              Download materials from the subject page to read them offline in this bento grid.
            </p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: Main Screen — Subject Folders (#EFECE1 Neo-Brutalist Theme)
  // =========================================================================
  return (
    <div className="px-[18px] pt-4 pb-20 min-h-screen flex flex-col bg-[#EFECE1]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-black text-[22px] text-[#1C1B17] leading-tight">Saved Offline</h1>
          <p className="text-[12px] text-[#1C1B17]/70 mt-0.5 font-medium">
            Subject folders · Read anytime with 0 internet
          </p>
        </div>
        {files.length > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-black bg-[#1C1B17] text-[#C8E600] px-3 py-1.5 rounded-full border border-[#1C1B17] shadow-[2px_2px_0_#1C1B17]">
            <HardDriveIcon className="w-3.5 h-3.5 text-[#C8E600]" />
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
            const sizeMb = (subjectData.totalSizeKb / 1024).toFixed(1);
            const shortCode = deriveSubjectShortCode(subjectName);

            return (
              <div
                key={subjectName}
                onClick={() => handleOpenSubjectFolder(subjectName)}
                className="border-[2px] border-[#1C1B17] rounded-2xl p-4 bg-[#FAF9F5] shadow-[3px_3px_0_#1C1B17] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all hover:bg-white"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Folder Icon Badge */}
                  <div className="w-12 h-12 rounded-2xl bg-[#C8E600] border-[2px] border-[#1C1B17] shadow-[2px_2px_0_#1C1B17] flex items-center justify-center shrink-0 text-[#1C1B17]">
                    <FolderIcon className="w-6 h-6 fill-[#C8E600]" />
                  </div>

                  {/* Folder Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-black bg-[#1C1B17] text-[#C8E600] px-2 py-0.5 rounded border border-[#1C1B17]">
                        {shortCode}
                      </span>
                      <span className="font-mono text-[10px] text-[#1C1B17]/70 font-semibold">
                        {notesCount + pyqsCount} files
                      </span>
                    </div>

                    <h2 className="font-black text-[15px] text-[#1C1B17] leading-snug line-clamp-1">
                      {subjectName}
                    </h2>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="font-mono text-[10px] font-bold bg-[#EFECE1] text-[#1C1B17] px-2 py-0.5 rounded-full border border-[#1C1B17]/40">
                        {notesCount} {notesCount === 1 ? 'Note' : 'Notes'}
                      </span>
                      {pyqsCount > 0 && (
                        <span className="font-mono text-[10px] font-bold bg-purple-900 text-white px-2 py-0.5 rounded-full">
                          {pyqsCount} {pyqsCount === 1 ? 'PYQ' : 'PYQs'}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-[#1C1B17]/70 font-medium">
                        · {sizeMb} MB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-9 h-9 rounded-xl bg-[#EFECE1] border-[1.5px] border-[#1C1B17] flex items-center justify-center shrink-0 text-[#1C1B17] shadow-[2px_2px_0_#1C1B17]">
                  <ChevronRightIcon className="w-5 h-5" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="border-[2px] border-dashed border-[#1C1B17]/40 rounded-2xl p-8 bg-[#FAF9F5] flex flex-col items-center justify-center text-center gap-3 mt-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#C8E600] border-[2px] border-[#1C1B17] flex items-center justify-center text-[#1C1B17] shadow-[2px_2px_0_#1C1B17]">
              <FolderIcon className="w-7 h-7" />
            </div>
            <div>
              <p className="font-black text-[16px] text-[#1C1B17]">No offline folders yet</p>
              <p className="text-[12px] text-[#1C1B17]/70 max-w-[260px] mt-1 leading-relaxed">
                When you download notes and question papers, they will be organized here cleanly into subject folders with a 2-column Bento grid.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-2 px-5 py-2.5 rounded-xl bg-[#1C1B17] text-[#C8E600] font-black text-[12px] border-[2px] border-[#1C1B17] shadow-[2px_2px_0_#1C1B17] active:scale-95 transition-transform"
            >
              Browse Subjects
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

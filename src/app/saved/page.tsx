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
  SparklesIcon
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
  const [examTimetable, setExamTimetable] = useState<any>({});
  const router = useRouter();

  useEffect(() => {
    // 1. Instantly display downloaded files from local storage with 0ms delay
    const immediate = (OfflineManager as any).getDownloadedFiles();
    if (immediate && immediate.length > 0) {
      setFiles(immediate.sort((a: any, b: any) => (b.downloadedAt || 0) - (a.downloadedAt || 0)));
    }

    // 2. Load timetable from local storage
    try {
      const savedTimetable = localStorage.getItem('semkit_exam_timetable_v2');
      if (savedTimetable) setExamTimetable(JSON.parse(savedTimetable));
    } catch(e) {}

    // 3. Background sync
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
      return `Notes Unit ${title.replace(/unit\s*/i, '')}`;
    }

    return title || 'Lecture Notes';
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

  // Calculate Exam Prep countdown & progress for the selected subject
  const getSubjectExamPrep = (subjectName: string, notesCount: number) => {
    const totalUnits = 5; // standard academic units
    const progressPercent = Math.min(100, Math.round((notesCount / totalUnits) * 100));

    const flat = examTimetable.flatLookup || {};
    const nameKey = subjectName.toLowerCase().trim();
    const cfg = flat[nameKey] || null;

    let countdownText = '7 days to exams'; // default fallback shown in design

    if (cfg) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dates = [
        { type: 'Mid-1', dateStr: cfg.mid1_date },
        { type: 'Mid-2', dateStr: cfg.mid2_date },
        { type: 'Final', dateStr: cfg.sem_exam_date }
      ].filter(d => d.dateStr);

      for (const d of dates) {
        const examDate = new Date(`${d.dateStr}T00:00:00`);
        const diffDays = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          if (diffDays === 0) countdownText = `🔥 ${d.type} Exam Today!`;
          else if (diffDays === 1) countdownText = `⏳ ${d.type} Exam Tomorrow`;
          else countdownText = `${diffDays} days to ${d.type} exams`;
          break;
        }
      }
    }

    return {
      countdownText,
      downloadedCount: notesCount,
      totalUnits,
      progressPercent
    };
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
              const sizeMb = file.sizeKb && file.sizeKb > 0 ? (file.sizeKb / 1024).toFixed(1) : '0.8';

              return (
                <div
                  key={file.filename || idx}
                  className="border-[2px] border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] overflow-hidden flex items-stretch transition-all"
                >
                  {/* Left Paper Thumbnail */}
                  <div 
                    onClick={() => handleOpenInApp(file.filename, displayTitle)}
                    className="w-14 bg-purple-100 flex items-center justify-center text-purple-900 shrink-0 border-r-[1.5px] border-[var(--ink)] cursor-pointer hover:bg-purple-200 transition-colors"
                  >
                    <GraduationCapIcon className="w-6 h-6" />
                  </div>

                  {/* Middle Details (Clean, no 'Offline Ready' banner) */}
                  <div 
                    onClick={() => handleOpenInApp(file.filename, displayTitle)}
                    className="flex-1 p-3 flex flex-col justify-center min-w-0 cursor-pointer hover:bg-[var(--paper-deep)] transition-colors"
                  >
                    <h3 className="font-bold text-[14.5px] text-[var(--ink)] leading-snug truncate">
                      {displayTitle}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--ink-soft)] font-medium">
                      <span>• {sizeMb} MB</span>
                      <span className="text-[11px] text-[var(--ink)] font-semibold">Tap Card to Read</span>
                    </div>
                  </div>

                  {/* Right Side Vertical Split Controls (Match Image 2) */}
                  <div className="w-12 shrink-0 border-l-[1.5px] border-[var(--ink)] flex flex-col">
                    <button
                      type="button"
                      onClick={(e) => handleOpenExternal(e, file.filename)}
                      className="flex-1 flex items-center justify-center hover:bg-[#D7E600] active:bg-[#D7E600] transition-colors border-b-[1.5px] border-[var(--ink)] cursor-pointer text-[var(--ink)]"
                      title="Open in Adobe Acrobat, Google Drive, WPS"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, file.filename)}
                      className="flex-1 flex items-center justify-center hover:bg-[var(--red-bg)] text-[var(--ink-faint)] hover:text-[var(--red)] transition-colors cursor-pointer"
                      title="Delete paper"
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
                Download past question papers from the subject screen to read them offline here.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Inside Subject Folder (Match Image 1 & Image 2 Exactly!)
  // =========================================================================
  if (selectedSubject && viewMode === 'notes') {
    const currentSubjectData = groupedData[selectedSubject] || { notes: [], pyqs: [], totalSizeKb: 0 };
    const notesList = currentSubjectData.notes;
    const pyqList = currentSubjectData.pyqs;
    const totalFilesCount = notesList.length + pyqList.length;

    const prep = getSubjectExamPrep(selectedSubject, notesList.length);

    // SVG Circular Ring math
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (prep.progressPercent / 100) * circumference;

    return (
      <div className="px-[18px] pt-4 pb-16 min-h-full flex flex-col bg-[var(--paper)]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBackToAllFolders}
              className="w-9 h-9 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper-card)] flex items-center justify-center text-[var(--ink)] active:scale-95 transition-transform shadow-[2px_2px_0_var(--ink)] cursor-pointer shrink-0"
              aria-label="Back to all folders"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-bold">
                SUBJECT FOLDER
              </span>
              <h1 className="font-bold text-[18px] text-[var(--ink)] leading-tight truncate">
                {selectedSubject}
              </h1>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold bg-[var(--ink)] text-[var(--paper)] px-3 py-1 rounded-full shrink-0">
            {totalFilesCount} {totalFilesCount === 1 ? 'file' : 'files'}
          </span>
        </div>

        {/* 1. EXAM PREP HUB CARD (Match Image 1 Exactly!) */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[#18181B] text-white shadow-[3px_3px_0_var(--ink)] mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              EXAM PREP HUB
            </div>
            <div className="font-black text-[21px] text-[#D7E600] leading-tight mb-1">
              {prep.countdownText}
            </div>
            <div className="font-mono text-[11.5px] text-zinc-300">
              Unit progress: {prep.downloadedCount}/{prep.totalUnits} downloaded
            </div>
          </div>

          {/* Circular Progress Ring */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="stroke-zinc-800"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="stroke-[#D7E600] transition-all duration-500 ease-out"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-[13px] text-white">
              {prep.progressPercent}%
            </div>
          </div>
        </div>

        {/* 2. TOP PREVIOUS YEAR PAPERS (PYQ) FOLDER CARD (Match Image 2 Exactly!) */}
        <div className="border-[2px] border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] mb-6 overflow-hidden">
          {/* Folder Tab Header */}
          <div 
            onClick={handleOpenPyqFolder}
            className="p-3.5 pb-2.5 flex items-center justify-between cursor-pointer hover:bg-[var(--paper-deep)] transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-[var(--ink)]">
                PREVIOUS YEAR PAPERS (PYQ)
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold bg-purple-700 text-white px-2.5 py-0.5 rounded-full">
              Folder
            </span>
          </div>

          {/* Preview Tiles Container */}
          <div className="px-3.5 pb-3">
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {pyqList.length > 0 ? (
                pyqList.map((pyq, idx) => {
                  const displayTitle = cleanDisplayTitle(pyq.title, selectedSubject);
                  const sizeMb = pyq.sizeKb && pyq.sizeKb > 0 ? (pyq.sizeKb / 1024).toFixed(1) : '0.8';

                  return (
                    <div
                      key={pyq.filename || idx}
                      onClick={() => handleOpenInApp(pyq.filename, displayTitle)}
                      className="border-[1.5px] border-[var(--ink)] rounded-xl p-2.5 bg-[var(--paper)] min-w-[170px] max-w-[200px] flex items-center gap-2.5 shadow-[2px_2px_0_var(--ink)] cursor-pointer active:scale-95 transition-all hover:bg-[var(--paper-deep)] shrink-0"
                    >
                      {/* Paper Graphic Thumbnail */}
                      <div className="w-10 h-12 rounded border border-[var(--ink)] bg-white flex flex-col justify-between p-1 shadow-xs shrink-0">
                        <div className="space-y-1">
                          <div className="h-0.5 w-full bg-zinc-300 rounded"></div>
                          <div className="h-0.5 w-3/4 bg-zinc-300 rounded"></div>
                          <div className="h-0.5 w-4/5 bg-zinc-300 rounded"></div>
                        </div>
                        <div className="text-[7px] font-mono text-zinc-400 text-center">PDF</div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[12px] text-[var(--ink)] leading-tight truncate">
                          {displayTitle}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5">
                          {sizeMb} MB
                        </div>
                        <div className="inline-block mt-1 font-mono text-[9px] font-bold bg-[var(--paper-deep)] text-[var(--ink)] px-1.5 py-0.2 rounded border border-[var(--rule-strong)]">
                          Saved Offline
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div 
                  onClick={handleOpenPyqFolder}
                  className="w-full border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-xl p-3 bg-[var(--paper)] flex items-center justify-between cursor-pointer hover:bg-[var(--paper-deep)]"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCapIcon className="w-4 h-4 text-purple-700" />
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                      No question papers saved yet. Tap to view folder.
                    </span>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-[var(--ink-soft)]" />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Bar inside Folder Card (Match Image 2 Exactly!) */}
          <div className="px-3.5 py-2.5 border-t border-[var(--rule-strong)] bg-[var(--paper)] flex items-center justify-between gap-2">
            <div className="bg-[var(--ink)] text-[var(--paper)] text-[11px] font-medium px-3 py-1.5 rounded-lg truncate">
              Tap document to read on native PDF engine
            </div>
            <button
              type="button"
              onClick={handleOpenPyqFolder}
              className="px-3 py-1.5 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--paper-card)] hover:bg-[#D7E600] text-[var(--ink)] font-bold text-[11px] flex items-center gap-1 shadow-[2px_2px_0_var(--ink)] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5" />
              <span>Other Apps</span>
            </button>
          </div>
        </div>

        {/* 3. LECTURE NOTES HEADER (Match Image 2 Exactly!) */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-4 h-4 text-[var(--ink)]" />
            <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-[var(--ink)]">
              LECTURE NOTES ({notesList.length})
            </span>
          </div>
          <span className="text-[11px] text-[var(--ink-soft)] font-medium">
            Tap anywhere on card to view in native PDF viewer
          </span>
        </div>

        {/* 4. LECTURE NOTES LIST (Match Image 2 Exactly — NO 'Offline Ready' banner!) */}
        <div className="flex flex-col gap-3">
          {notesList.length > 0 ? (
            notesList.map((file, idx) => {
              const displayTitle = cleanDisplayTitle(file.title, selectedSubject);
              const sizeMb = file.sizeKb && file.sizeKb > 0 ? (file.sizeKb / 1024).toFixed(1) : '1.3';

              return (
                <div
                  key={file.filename || idx}
                  className="border-[2px] border-[var(--ink)] rounded-2xl bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] overflow-hidden flex items-stretch transition-all"
                >
                  {/* Left Lime Square Icon (Match Image 2) */}
                  <div 
                    onClick={() => handleOpenInApp(file.filename, displayTitle)}
                    className="w-14 bg-[#D7E600] flex items-center justify-center text-[var(--ink)] shrink-0 border-r-[1.5px] border-[var(--ink)] cursor-pointer hover:bg-[#c4d200] transition-colors"
                  >
                    <FileTextIcon className="w-6 h-6" />
                  </div>

                  {/* Middle Content Details (Clean title, size, NO banner!) */}
                  <div 
                    onClick={() => handleOpenInApp(file.filename, displayTitle)}
                    className="flex-1 p-3.5 flex flex-col justify-center min-w-0 cursor-pointer hover:bg-[var(--paper-deep)] transition-colors"
                  >
                    <h3 className="font-bold text-[15px] text-[var(--ink)] leading-snug truncate">
                      {displayTitle}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--ink-soft)] font-medium">
                      <span>• {sizeMb} MB</span>
                      <span className="text-[11.5px] text-[var(--ink)] font-semibold">Tap Card to Read</span>
                    </div>
                  </div>

                  {/* Right Vertical Split Controls (Match Image 2) */}
                  <div className="w-12 shrink-0 border-l-[1.5px] border-[var(--ink)] flex flex-col">
                    <button
                      type="button"
                      onClick={(e) => handleOpenExternal(e, file.filename)}
                      className="flex-1 flex items-center justify-center hover:bg-[#D7E600] active:bg-[#D7E600] transition-colors border-b-[1.5px] border-[var(--ink)] cursor-pointer text-[var(--ink)]"
                      title="Open in Adobe Acrobat, Google Drive, WPS"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, file.filename)}
                      className="flex-1 flex items-center justify-center hover:bg-[var(--red-bg)] text-[var(--ink-faint)] hover:text-[var(--red)] transition-colors cursor-pointer"
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
                Download notes from the subject screen to read them offline here.
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

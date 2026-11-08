'use client';

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ChevronLeftIcon, 
  ChevronDownIcon, 
  FileTextIcon, 
  HelpCircleIcon, 
  Loader2Icon,
  DownloadIcon,
  FolderDownIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  TrashIcon,
  PlayIcon,
  ClockIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUnitColor } from "@/lib/colorUtils";
import { OfflineManager } from "@/lib/offlineManager";
import { deriveSubjectShortCode } from "@/lib/subjectNaming";
import { DEFAULT_EXAM_TIMETABLE } from "@/lib/defaultExamTimetable";

const DEFAULT_R2_URL = 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev';

function extractSubjectId(searchParams: URLSearchParams | null): string | null {
  const fromParams = searchParams?.get('id');
  if (fromParams && fromParams.trim() && fromParams !== 'null' && fromParams !== 'undefined') {
    return fromParams.trim();
  }
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const fromSearch = urlParams.get('id');
    if (fromSearch && fromSearch.trim() && fromSearch !== 'null' && fromSearch !== 'undefined') {
      return fromSearch.trim();
    }
    if (window.location.hash && window.location.hash.includes('id=')) {
      const qIndex = window.location.hash.indexOf('?');
      if (qIndex !== -1) {
        const fromHash = new URLSearchParams(window.location.hash.substring(qIndex)).get('id');
        if (fromHash && fromHash.trim()) return fromHash.trim();
      }
    }
  }
  return null;
}

function SubjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [subjectId, setSubjectId] = useState<string | null>(() => extractSubjectId(searchParams));
  const [subject, setSubject] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [pyqs, setPyqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initChecked, setInitChecked] = useState(false);
  const [isPyqOpen, setIsPyqOpen] = useState(false);
  
  // Real-time map of which files are downloaded: filename -> boolean
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({});
  
  // 1-Click pack state
  const [isDownloadingPack, setIsDownloadingPack] = useState(false);
  const [packProgress, setPackProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Exam Timetable state
  const [examTimetable, setExamTimetable] = useState<any>({});

  const supabase = createClient();

  // Load Exam Timetable for countdown
  useEffect(() => {
    let initialTimetable = DEFAULT_EXAM_TIMETABLE;
    try {
      const local = localStorage.getItem('semkit_exam_timetable_v2');
      if (local) {
        initialTimetable = JSON.parse(local);
      } else {
        localStorage.setItem('semkit_exam_timetable_v2', JSON.stringify(DEFAULT_EXAM_TIMETABLE));
      }
    } catch(e) {}
    setExamTimetable(initialTimetable);

    async function fetchTimetable() {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { data } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'exam_timetable_v2')
            .maybeSingle();

          if (data && data.value) {
            const parsed = JSON.parse(data.value);
            if (parsed && (parsed.flatLookup || Object.keys(parsed).length > 0)) {
              setExamTimetable(parsed);
              localStorage.setItem('semkit_exam_timetable_v2', JSON.stringify(parsed));
            }
          }
        } catch(err) {}
      }
    }
    fetchTimetable();
  }, [supabase]);

  // Sync offline status of all files in real time
  const syncOfflineStatus = async () => {
    const allItems = [...notes, ...pyqs];
    if (allItems.length === 0) return;

    const newMap: Record<string, boolean> = {};
    for (const item of allItems) {
      if (!item.file_url) continue;
      const fn = OfflineManager.getFileName(item.file_url);
      const isDownloaded = await OfflineManager.isFileDownloaded(fn);
      newMap[fn] = isDownloaded;
      newMap[item.file_url] = isDownloaded;
    }
    setDownloadedMap(newMap);
  };

  useEffect(() => {
    syncOfflineStatus();

    const handleSync = () => syncOfflineStatus();
    window.addEventListener('offline_files_changed', handleSync);
    window.addEventListener('offline_file_deleted', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('offline_files_changed', handleSync);
      window.removeEventListener('offline_file_deleted', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [notes, pyqs]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  // Resolve ID with fallback for client-side hydration
  useEffect(() => {
    const sid = extractSubjectId(searchParams);
    if (sid) {
      setSubjectId(sid);
      setInitChecked(true);
    } else {
      const timer = setTimeout(() => {
        const retrySid = extractSubjectId(searchParams);
        if (retrySid) {
          setSubjectId(retrySid);
        }
        setInitChecked(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Load subject & content
  useEffect(() => {
    if (!subjectId) {
      if (initChecked) setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        let subData: any = null;
        const { data: joinedData } = await supabase
          .from('subjects')
          .select('*, regulations(code), branches(code)')
          .eq('id', subjectId)
          .maybeSingle();

        if (joinedData) {
          subData = joinedData;
        } else {
          const { data: rawSub } = await supabase
            .from('subjects')
            .select('*')
            .eq('id', subjectId)
            .maybeSingle();
          subData = rawSub;
        }

        if (!isMounted) return;
        setSubject(subData);

        if (subData) {
          const { data: contentData } = await supabase
            .from('content_items')
            .select('*')
            .eq('subject_id', subjectId)
            .eq('status', 'published')
            .order('created_at', { ascending: true });

          if (!isMounted) return;

          if (contentData) {
            const rawNotes = contentData.filter((c: any) => c.type !== 'pyq');
            
            // Auto-detect unit number if null or 0 from title
            const processedNotes = rawNotes.map((n: any, idx: number) => {
              let uNum = n.unit_number;
              if (!uNum || uNum < 1 || uNum > 5) {
                const match = `${n.title} ${n.file_url}`.match(/unit[-_\s]*([1-5])/i);
                uNum = match ? parseInt(match[1]) : 1;
              }

              return {
                ...n,
                unit_number: uNum,
                displayTitle: n.title ? n.title.replace(/^null\s+/, '').trim() : `Note ${idx + 1}`
              };
            });

            setNotes(processedNotes);
            setPyqs(contentData.filter((c: any) => c.type === 'pyq').sort((a: any, b: any) => (b.exam_year || 0) - (a.exam_year || 0)));
          }
        }
      } catch (err) {
        console.error('Error loading subject data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [subjectId, initChecked]);

  // Derived short code for this subject (e.g. CIS, DSV, FBT)
  const shortCode = useMemo(() => {
    return deriveSubjectShortCode(subject?.name || '', subject?.code);
  }, [subject]);

  // Exam Countdown Calculation
  const examCountdown = useMemo(() => {
    if (!subject) return { text: 'Exams Scheduled Soon', days: 7, isSet: false };

    const codeKey = (subject.code || '').toUpperCase().trim();
    const nameKey = (subject.name || '').toLowerCase().trim();
    const flat = examTimetable.flatLookup || {};
    const cfg = flat[codeKey] || flat[nameKey] || flat[subject.id] || null;

    if (!cfg) {
      return { text: '7 days to exams', days: 7, isSet: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [
      { type: 'Mid-1', dateStr: cfg.mid1_date },
      { type: 'Mid-2', dateStr: cfg.mid2_date },
      { type: 'Final', dateStr: cfg.sem_exam_date }
    ].filter(d => d.dateStr);

    let nearest: { type: string; dateStr: string; diffDays: number } | null = null;
    for (const d of dates) {
      const examDate = new Date(`${d.dateStr}T00:00:00`);
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        if (!nearest || diffDays < nearest.diffDays) {
          nearest = { type: d.type, dateStr: d.dateStr, diffDays };
        }
      }
    }

    if (!nearest) {
      return { text: 'Exam Finished', days: 0, isSet: true };
    }

    if (nearest.diffDays === 0) {
      return { text: `🔥 ${nearest.type} Today!`, days: 0, isSet: true };
    }
    if (nearest.diffDays === 1) {
      return { text: `⏳ ${nearest.type} Tomorrow`, days: 1, isSet: true };
    }
    return { text: `${nearest.diffDays} days to exams`, days: nearest.diffDays, isSet: true };
  }, [subject, examTimetable]);

  // All downloadable files
  const allDownloadableFiles = useMemo(() => {
    return [...notes, ...pyqs].filter(f => f && f.file_url && f.file_url.trim().length > 0);
  }, [notes, pyqs]);

  // Number of downloaded files
  const downloadedFilesCount = useMemo(() => {
    return allDownloadableFiles.filter(item => {
      const fn = OfflineManager.getFileName(item.file_url);
      return downloadedMap[fn] || downloadedMap[item.file_url];
    }).length;
  }, [allDownloadableFiles, downloadedMap]);

  // Unit progress calculation (downloaded files / total files)
  const unitProgress = useMemo(() => {
    const total = allDownloadableFiles.length;
    if (total === 0) return { downloaded: 0, total: 5, percentage: 0 };
    const downloaded = downloadedFilesCount;
    const percentage = Math.min(100, Math.round((downloaded / total) * 100));
    return { downloaded, total, percentage };
  }, [allDownloadableFiles, downloadedFilesCount]);

  // Check if ALL downloadable files are downloaded
  const isPackDownloaded = useMemo(() => {
    if (allDownloadableFiles.length === 0) return false;
    return downloadedFilesCount === allDownloadableFiles.length;
  }, [allDownloadableFiles, downloadedFilesCount]);

  // Missing files count for 1-click pack
  const missingFilesCount = useMemo(() => {
    return allDownloadableFiles.length - downloadedFilesCount;
  }, [allDownloadableFiles, downloadedFilesCount]);

  // 1-Click Download Subject Pack
  const handleDownloadPack = async () => {
    if (allDownloadableFiles.length === 0) return;
    setIsDownloadingPack(true);

    for (let i = 0; i < allDownloadableFiles.length; i++) {
      const item = allDownloadableFiles[i];
      const fn = OfflineManager.getFileName(item.file_url);
      setPackProgress({
        current: i + 1,
        total: allDownloadableFiles.length,
        message: item.title || `File ${i + 1}`
      });

      const already = await OfflineManager.isFileDownloaded(fn);
      if (!already) {
        const fullUrl = item.file_url.startsWith('http') 
          ? item.file_url 
          : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${item.file_url}`;
        await OfflineManager.downloadFile(fullUrl, fn);
      }
      OfflineManager.saveMetadata(fn, item.title, item.file_size_kb, subject?.name, item.type === 'pyq');
    }

    setIsDownloadingPack(false);
    setPackProgress(null);
    syncOfflineStatus();
  };

  // Download a single file
  const handleDownloadSingle = async (e: React.MouseEvent, item: any, titleToSave?: string) => {
    e.stopPropagation();
    const fn = OfflineManager.getFileName(item.file_url);
    setDownloadingMap(prev => ({ ...prev, [fn]: true }));

    const fullUrl = item.file_url.startsWith('http') 
      ? item.file_url 
      : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${item.file_url}`;

    await OfflineManager.downloadFile(fullUrl, fn);
    OfflineManager.saveMetadata(fn, titleToSave || item.title, item.file_size_kb, subject?.name, item.type === 'pyq');
    
    setDownloadingMap(prev => ({ ...prev, [fn]: false }));
    syncOfflineStatus();
  };

  // Delete a single file
  const handleDeleteSingle = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (confirm(`Delete ${item.title || 'this file'} from offline storage?`)) {
      const fn = OfflineManager.getFileName(item.file_url);
      await OfflineManager.deleteFile(fn);
      syncOfflineStatus();
    }
  };

  // Open file in in-app reader, automatically downloading first if not yet cached offline
  const handleOpenInApp = async (item: any, displayTitle: string) => {
    if (!item || !item.file_url) return;
    const fileUrl = item.file_url;
    const fn = OfflineManager.getFileName(fileUrl);
    const title = displayTitle || item.title || 'Lecture Note';

    // Check if already downloaded
    const alreadyDownloaded = await OfflineManager.isFileDownloaded(fn);
    if (alreadyDownloaded) {
      router.push(`/read?file=${encodeURIComponent(fn)}&title=${encodeURIComponent(title)}`);
      return;
    }

    // Auto-download first with active progress spinner
    try {
      setDownloadingMap(prev => ({ ...prev, [fn]: true }));
      const fullUrl = fileUrl.startsWith('http') 
        ? fileUrl 
        : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${fileUrl}`;

      await OfflineManager.downloadFile(fullUrl, fn);
      OfflineManager.saveMetadata(fn, title, item.file_size_kb, subject?.name, item.type === 'pyq');
      
      setDownloadedMap(prev => ({ ...prev, [fn]: true, [fileUrl]: true }));
      setDownloadingMap(prev => ({ ...prev, [fn]: false }));

      // Navigate to reader immediately after download completes
      router.push(`/read?file=${encodeURIComponent(fn)}&title=${encodeURIComponent(title)}`);
    } catch (err) {
      console.error('Failed to auto-download PDF:', err);
      setDownloadingMap(prev => ({ ...prev, [fn]: false }));
      // Fallback navigation
      router.push(`/read?file=${encodeURIComponent(fn)}&title=${encodeURIComponent(title)}`);
    }
  };

  // Open in external app
  const handleOpenExternal = async (e: React.MouseEvent, fileUrl: string) => {
    e.stopPropagation();
    const fn = OfflineManager.getFileName(fileUrl);
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { FileOpener } = await import('@capacitor-community/file-opener');
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        const { uri } = await Filesystem.getUri({
          path: `pdf_cache/${fn}`,
          directory: Directory.Data
        });
        await FileOpener.open({ filePath: uri });
      } else {
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${fileUrl}`;
        window.open(fullUrl, '_blank');
      }
    } catch (err) {
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_URL}/${fileUrl}`;
      window.open(fullUrl, '_blank');
    }
  };

  if (loading || (!subject && !initChecked)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#EFECE1]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[#1C1B17] mb-2" />
        <p className="text-[12px] font-bold text-[#1C1B17]/70">Loading subject materials...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="flex flex-col min-h-screen bg-[#EFECE1] p-6 items-center justify-center text-center">
        <h1 className="font-black text-[20px] text-[#1C1B17] mb-2">Subject not found</h1>
        <p className="text-[12px] text-[#1C1B17]/70 mb-5 max-w-[260px]">
          The requested subject could not be located.
        </p>
        <button
          onClick={handleBack}
          type="button"
          className="bg-[#1C1B17] text-[#C8E600] font-black text-[12px] px-5 py-2.5 rounded-xl border-2 border-[#1C1B17] shadow-[2px_2px_0_#1C1B17] active:scale-95 transition-all inline-flex items-center gap-1.5"
        >
          <ChevronLeftIcon className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const totalUnits = subject.total_units || 5;
  const groups = Array.from({ length: totalUnits }, (_, i) => i + 1);

  return (
    <div className="min-h-screen flex flex-col bg-[#EFECE1] pb-24">
      {/* Top Header Bar */}
      <div className="px-[16px] py-3.5 border-b-2 border-[#1C1B17] bg-[#FAF9F5] flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={handleBack}
            type="button"
            aria-label="Back"
            className="w-9 h-9 rounded-xl border-2 border-[#1C1B17] bg-[#FAF9F5] flex items-center justify-center text-[#1C1B17] active:scale-95 transition-transform shadow-[2px_2px_0_#1C1B17] cursor-pointer shrink-0"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <span className="font-mono text-[9.5px] font-black uppercase tracking-wider text-[#1C1B17]/60 block leading-tight">
              SUBJECT FOLDER
            </span>
            <h1 className="font-black text-[17px] text-[#1C1B17] leading-tight truncate mt-0.5">
              {subject.name}
            </h1>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-black bg-[#1C1B17] text-[#C8E600] px-2.5 py-1 rounded-full border border-[#1C1B17]">
            {allDownloadableFiles.length} {allDownloadableFiles.length === 1 ? 'file' : 'files'}
          </span>
        </div>
      </div>

      <div className="px-[16px] py-4 flex-1">
        
        {/* 1. EXAM PREP HUB BANNER (Image 4) */}
        <div className="bg-[#1C1B17] text-white p-4 rounded-2xl border-2 border-[#1C1B17] shadow-[3px_3px_0_#1C1B17] mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
              EXAM PREP HUB
            </div>
            <div className="text-[20px] font-black text-[#C8E600] leading-tight mb-1">
              {examCountdown.text}
            </div>
            <div className="font-mono text-[11px] text-zinc-300">
              Unit progress: {unitProgress.downloaded}/{unitProgress.total} downloaded
            </div>
          </div>

          {/* Circular Progress Ring (67% style) */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-zinc-800"
                strokeWidth="3.8"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#C8E600] transition-all duration-500 ease-out"
                strokeDasharray={`${unitProgress.percentage}, 100`}
                strokeWidth="3.8"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono text-[11px] font-black text-white">
              {unitProgress.percentage}%
            </span>
          </div>
        </div>

        {/* 2. 1-CLICK OFFLINE SUBJECT PACK BANNER */}
        <div className="border-2 border-[#1C1B17] rounded-2xl p-4 bg-[#FAF9F5] mb-5 shadow-[3px_3px_0_#1C1B17]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FolderDownIcon className="w-4 h-4 text-[#1C1B17]" />
                <span className="font-black text-[13.5px] text-[#1C1B17]">
                  1-Click Offline Subject Pack
                </span>
              </div>
              <p className="text-[11px] text-[#1C1B17]/70 font-medium leading-tight">
                {allDownloadableFiles.length > 0 
                  ? `Download all ${allDownloadableFiles.length} notes & PYQs to study offline without internet`
                  : 'No PDFs uploaded yet for this subject.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPack}
              disabled={isDownloadingPack || allDownloadableFiles.length === 0}
              className={`font-black text-[11.5px] px-3.5 py-2.5 rounded-xl border-2 border-[#1C1B17] shadow-[2px_2px_0_#1C1B17] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isPackDownloaded 
                  ? 'bg-[#1C1B17] text-[#C8E600]' 
                  : 'bg-[#C8E600] text-[#1C1B17]'
              }`}
            >
              {allDownloadableFiles.length === 0 ? (
                <span>Coming Soon</span>
              ) : isDownloadingPack ? (
                <>
                  <Loader2Icon className="w-4 h-4 animate-spin text-[#1C1B17]" />
                  <span>{packProgress?.current || 1}/{packProgress?.total || 1}</span>
                </>
              ) : isPackDownloaded ? (
                <>
                  <CheckCircle2Icon className="w-4 h-4 text-[#C8E600]" />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4 text-[#1C1B17]" />
                  <span>{missingFilesCount < allDownloadableFiles.length ? `Download (${missingFilesCount})` : 'Download All'}</span>
                </>
              )}
            </button>
          </div>

          {isDownloadingPack && packProgress && (
            <div className="mt-3 pt-2.5 border-t border-[#1C1B17]/20">
              <div className="flex justify-between text-[10.5px] font-mono text-[#1C1B17]/70 mb-1">
                <span className="truncate pr-2">{packProgress.message}</span>
                <span className="shrink-0">{Math.round((packProgress.current / packProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-[#EFECE1] h-2 rounded-full overflow-hidden border border-[#1C1B17]">
                <div 
                  className="bg-[#1C1B17] h-full transition-all duration-300"
                  style={{ width: `${(packProgress.current / packProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. PREVIOUS YEAR PAPERS (PYQ) FOLDER AT THE TOP (Image 5) */}
        {pyqs.length > 0 && (
          <div className="border-2 border-[#1C1B17] rounded-2xl bg-[#FAF9F5] shadow-[3px_3px_0_#1C1B17] mb-6 overflow-hidden">
            {/* Folder Header */}
            <button
              type="button"
              onClick={() => setIsPyqOpen(prev => !prev)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <h2 className="font-black text-[13.5px] text-[#1C1B17] leading-tight">
                  PREVIOUS YEAR PAPERS (PYQ)
                </h2>
                <span className="font-mono text-[9px] font-black bg-purple-700 text-white px-2 py-0.5 rounded-full uppercase">
                  Folder
                </span>
                <span className="font-mono text-[10px] text-[#1C1B17]/70 font-bold">
                  ({pyqs.length})
                </span>
              </div>
              <ChevronDownIcon className={`w-4 h-4 text-[#1C1B17] transition-transform duration-200 ${isPyqOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Folder Body (Cards inside) */}
            {isPyqOpen && (
              <div className="p-3 pt-0 border-t border-[#1C1B17]/20 flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                  {pyqs.map((pyq) => {
                    const fn = OfflineManager.getFileName(pyq.file_url);
                    const isDownloaded = downloadedMap[fn] || downloadedMap[pyq.file_url];
                    const isDownloading = downloadingMap[fn];
                    const sizeMb = pyq.file_size_kb ? (pyq.file_size_kb / 1024).toFixed(1) : '0.8';
                    const pyqTitle = `${shortCode} PYQ - ${pyq.exam_year || 2025}`;

                    return (
                      <div
                        key={pyq.id}
                        onClick={() => handleOpenInApp(pyq, pyqTitle)}
                        className="border-2 border-[#1C1B17] rounded-xl bg-white p-3 shadow-[2px_2px_0_#1C1B17] flex flex-col justify-between min-h-[140px] cursor-pointer active:scale-[0.98] transition-all hover:bg-[#FAF9F5]"
                      >
                        {/* Thumbnail & Title */}
                        <div>
                          <div className="w-7 h-7 rounded-lg bg-[#EFECE1] border border-[#1C1B17] flex items-center justify-center text-[#1C1B17] mb-2 shadow-xs">
                            <FileTextIcon className="w-4 h-4" />
                          </div>
                          <h3 className="font-black text-[12.5px] text-[#1C1B17] leading-snug line-clamp-2">
                            {pyqTitle}
                          </h3>
                          <div className="font-mono text-[10px] text-[#1C1B17]/60 font-semibold mt-0.5">
                            {sizeMb} MB
                          </div>
                        </div>

                        {/* Status & Action */}
                        <div className="mt-2 pt-2 border-t border-[#1C1B17]/15 flex items-center justify-between">
                          {isDownloading ? (
                            <span className="font-mono text-[9px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
                              <Loader2Icon className="w-2.5 h-2.5 animate-spin" /> Downloading...
                            </span>
                          ) : isDownloaded ? (
                            <span className="font-mono text-[9px] font-black bg-[#EFECE1] text-[#1C1B17] px-2 py-0.5 rounded border border-[#1C1B17]">
                              Saved Offline
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] font-bold text-[#1C1B17]/60">
                              Tap to Read
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            {isDownloaded && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenExternal(e, pyq.file_url)}
                                className="w-6 h-6 rounded-md border border-[#1C1B17] bg-[#EFECE1] hover:bg-[#C8E600] flex items-center justify-center text-[#1C1B17] transition-all"
                                title="Open in other apps"
                              >
                                <ExternalLinkIcon className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => isDownloaded ? handleDeleteSingle(e, pyq) : handleDownloadSingle(e, pyq, pyqTitle)}
                              className="w-6 h-6 rounded-md border border-[#1C1B17] bg-[#FAF9F5] hover:bg-white flex items-center justify-center text-[#1C1B17] transition-all"
                            >
                              {isDownloading ? (
                                <Loader2Icon className="w-3 h-3 animate-spin text-[#1C1B17]" />
                              ) : isDownloaded ? (
                                <TrashIcon className="w-3 h-3 text-red-600" />
                              ) : (
                                <DownloadIcon className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Strip */}
                <div className="bg-[#1C1B17] text-white p-2.5 rounded-xl flex items-center justify-between mt-1">
                  <span className="text-[10.5px] font-bold text-zinc-300">
                    Tap document to read on native PDF engine
                  </span>
                  <button
                    type="button"
                    onClick={(e) => pyqs[0] && handleOpenExternal(e, pyqs[0].file_url)}
                    className="bg-[#FAF9F5] text-[#1C1B17] text-[10px] font-black px-2.5 py-1 rounded-lg border border-white flex items-center gap-1"
                  >
                    <ExternalLinkIcon className="w-3 h-3" />
                    <span>Other Apps</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. LECTURE NOTES SECTION (Image 5) */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-[14px] text-[#1C1B17] uppercase tracking-wide">
              LECTURE NOTES ({notes.length})
            </h2>
          </div>
          <span className="text-[10px] text-[#1C1B17]/60 font-medium">
            Tap card to view in native PDF viewer
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {groups.map(unitNum => {
            const unitNotes = notes.filter(n => n.unit_number === unitNum);

            return (
              <div key={unitNum} className="flex flex-col">
                {/* Unit Header Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`${getUnitColor(unitNum)} px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-[#1C1B17]/40`}>
                    Unit {unitNum}
                  </span>
                  <div className="h-[1.5px] flex-1 bg-[#1C1B17]/20"></div>
                </div>

                {/* Unit Notes Cards */}
                {unitNotes.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {unitNotes.map((note, noteIdx) => {
                      const fn = OfflineManager.getFileName(note.file_url);
                      const isDownloaded = downloadedMap[fn] || downloadedMap[note.file_url];
                      const isDownloading = downloadingMap[fn];
                      const sizeMb = note.file_size_kb ? (note.file_size_kb / 1024).toFixed(1) : '1.3';
                      
                      // Clean automatic sequential title regardless of uploaded PDF name: CIS Unit-1-1, CIS Unit-1-2...
                      const cleanRawTitle = (note.title || '').replace(/^null\s+/, '').trim();
                      const displayTitle = (/^[A-Z0-9]{2,6}(\s+Lab)?\s+Unit-\d+-\d+$/i.test(cleanRawTitle))
                        ? cleanRawTitle
                        : `${shortCode} Unit-${unitNum}-${noteIdx + 1}`;

                      return (
                        <div
                          key={note.id || noteIdx}
                          onClick={() => handleOpenInApp(note, displayTitle)}
                          className="border-2 border-[#1C1B17] rounded-2xl p-3.5 bg-[#FAF9F5] shadow-[3px_3px_0_#1C1B17] flex items-center justify-between gap-3 cursor-pointer hover:bg-white active:scale-[0.99] transition-all"
                        >
                          {/* Left: Square Lime Icon Badge */}
                          <div className="w-11 h-11 rounded-xl bg-[#C8E600] border-2 border-[#1C1B17] shadow-[2px_2px_0_#1C1B17] flex items-center justify-center shrink-0 text-[#1C1B17]">
                            <FileTextIcon className="w-5 h-5 fill-[#C8E600]" />
                          </div>

                          {/* Middle: Clean Title & Size (NO 'Offline Ready' banner!) */}
                          <div className="flex-1 min-w-0 pr-2">
                            <h3 className="font-black text-[13.5px] text-[#1C1B17] leading-snug line-clamp-1">
                              {displayTitle}
                            </h3>
                            <div className="font-mono text-[10.5px] text-[#1C1B17]/60 font-semibold mt-0.5 flex items-center gap-2">
                              <span>{sizeMb} MB</span>
                              <span>·</span>
                              {isDownloading ? (
                                <span className="font-sans font-bold text-amber-800 flex items-center gap-1">
                                  <Loader2Icon className="w-3 h-3 animate-spin inline" /> Downloading & Opening...
                                </span>
                              ) : isDownloaded ? (
                                <span className="font-sans font-bold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2Icon className="w-3.5 h-3.5 inline text-emerald-600" /> Saved Offline · Tap to Read
                                </span>
                              ) : (
                                <span className="font-sans font-bold text-[#1C1B17]/80">
                                  Tap to Read (Auto-downloads)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDownloaded && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenExternal(e, note.file_url)}
                                className="w-8 h-8 rounded-xl border border-[#1C1B17] bg-[#EFECE1] hover:bg-[#C8E600] flex items-center justify-center text-[#1C1B17] shadow-[1px_1px_0_#1C1B17] active:scale-95 transition-all"
                                title="Open in other apps"
                              >
                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => isDownloaded ? handleDeleteSingle(e, note) : handleDownloadSingle(e, note, displayTitle)}
                              disabled={isDownloading}
                              className={`w-8 h-8 rounded-xl border border-[#1C1B17] flex items-center justify-center text-[#1C1B17] shadow-[1px_1px_0_#1C1B17] active:scale-95 transition-all ${
                                isDownloaded ? 'bg-[#FAF9F5] hover:bg-red-50 text-red-600' : 'bg-[#C8E600] hover:bg-[#bfe000]'
                              }`}
                              title={isDownloaded ? "Delete offline file" : "Download offline"}
                            >
                              {isDownloading ? (
                                <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                              ) : isDownloaded ? (
                                <TrashIcon className="w-3.5 h-3.5" />
                              ) : (
                                <DownloadIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-[#1C1B17]/30 rounded-xl p-3.5 bg-white/60 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1C1B17]/60">No PDFs uploaded yet</span>
                    <span className="font-mono text-[9.5px] font-black uppercase tracking-wider text-[#1C1B17]/40 bg-[#EFECE1] px-2 py-0.5 rounded border border-[#1C1B17]/20">
                      COMING SOON
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SubjectPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center bg-[#EFECE1] min-h-screen">Loading...</div>}>
      <SubjectContent />
    </Suspense>
  );
}

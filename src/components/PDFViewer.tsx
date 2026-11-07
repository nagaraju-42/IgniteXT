'use client';

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ChevronLeftIcon, 
  Loader2Icon, 
  Maximize2Icon, 
  Minimize2Icon, 
  ZoomInIcon, 
  ZoomOutIcon 
} from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function PDFViewer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const file = searchParams.get('file');
  const title = searchParams.get('title');

  const [dataUri, setDataUri] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 380);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1.0);
  const lastTapRef = useRef<number>(0);

  // Resize listener to adapt page width
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync fullscreen class on body to hide HeaderBar, BottomNav, FeedbackWidget
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('pdf-fullscreen-active');
    } else {
      document.body.classList.remove('pdf-fullscreen-active');
    }
    return () => {
      document.body.classList.remove('pdf-fullscreen-active');
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!file) return;

    const loadLocalPdf = async () => {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Capacitor } = await import('@capacitor/core');
        
        const result = await Filesystem.readFile({
          path: `pdf_cache/${file}`,
          directory: Directory.Data
        });

        if (Capacitor.isNativePlatform()) {
          // Native Android returns base64
          setDataUri(`data:application/pdf;base64,${result.data}`);
        } else {
          // Web returns a blob or base64
          if (result.data instanceof Blob) {
            setDataUri(URL.createObjectURL(result.data));
          } else {
            setDataUri(`data:application/pdf;base64,${result.data}`);
          }
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setError(true);
      }
    };

    loadLocalPdf();
  }, [file]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleOpenExternally = async () => {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { FileOpener } = await import('@capacitor-community/file-opener');
      const { uri } = await Filesystem.getUri({ path: `pdf_cache/${file}`, directory: Directory.Data });
      await FileOpener.open({ filePath: uri });
    } catch(e) { console.error(e); }
  };

  // Touch gesture handlers for finger pinch zoom and double tap
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // Double tap to zoom
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setScale(prev => prev > 1.2 ? 1.0 : 1.75);
      }
      lastTapRef.current = now;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchStartDistRef.current && touchStartDistRef.current > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = currentDist / touchStartDistRef.current;
      let nextScale = touchStartScaleRef.current * factor;
      nextScale = Math.min(Math.max(nextScale, 0.75), 3.5);
      setScale(Number(nextScale.toFixed(2)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
  };

  const handleBack = () => {
    if (isFullscreen) {
      setIsFullscreen(false);
    } else {
      router.back();
    }
  };

  if (!file) {
    return <div className="p-8 text-center bg-[var(--paper)] h-full">No file specified</div>;
  }

  // Base page width calculation
  const baseWidth = isFullscreen
    ? Math.min(viewportWidth - 16, 750)
    : Math.min(viewportWidth - 32, 600);

  const calculatedPageWidth = Math.round(baseWidth * scale);

  return (
    <div 
      className={
        isFullscreen 
          ? "fixed inset-0 z-[99999] w-screen h-screen bg-[#141414] flex flex-col overflow-hidden" 
          : "h-full flex flex-col bg-[var(--paper-deep)] relative overflow-hidden"
      }
    >
      {/* Top Header Bar */}
      <div className="bg-[var(--ink)] text-[var(--paper)] flex items-center justify-between px-2.5 py-2.5 shadow-md z-10 sticky top-0 shrink-0 select-none">
        <div className="flex items-center min-w-0 mr-2 flex-1">
          <button 
            onClick={handleBack} 
            className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white"
            aria-label="Back"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="font-semibold text-[14px] ml-1 truncate text-white">{title || 'Document'}</h1>
        </div>

        {/* Zoom Controls & Box-Shaped Fullscreen Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom Buttons with percentage */}
          <div className="flex items-center bg-white/15 rounded-lg p-0.5 border border-white/20">
            <button 
              onClick={() => setScale(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.75))}
              className="w-7 h-7 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 rounded active:scale-90 transition-all"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOutIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setScale(1.0)}
              className="px-1.5 text-[11px] font-mono font-bold text-white/90 hover:text-white transition-colors"
              title="Reset zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button 
              onClick={() => setScale(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3.5))}
              className="w-7 h-7 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 rounded active:scale-90 transition-all"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomInIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Box-shaped Fullscreen Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="w-8 h-8 rounded-lg border-[1.5px] border-white/40 bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white shadow-sm transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen (Box Mode)"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullscreen ? (
              <Minimize2Icon className="w-4 h-4 text-[#D7E600]" />
            ) : (
              <Maximize2Icon className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Main PDF Scrollable Container with pinch touch gestures */}
      <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-x-auto overflow-y-auto relative w-full flex flex-col items-center touch-pan-x touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {!dataUri && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink-soft)]" />
            <span className="text-[13px] text-[var(--ink-soft)] font-medium">Reading document...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <span className="text-[14px] font-medium text-[var(--ink)]">Failed to load internal reader.</span>
            <div className="flex gap-2">
              <button onClick={() => router.back()} className="px-4 py-2 bg-[var(--paper-card)] border border-[var(--rule)] text-[var(--ink)] rounded-lg text-sm font-bold">Go Back</button>
              <button onClick={handleOpenExternally} className="px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded-lg text-sm font-bold">
                Open Externally
              </button>
            </div>
          </div>
        )}

        {dataUri && !error && (
          <Document 
            file={dataUri} 
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setError(true)}
            loading={<Loader2Icon className="w-8 h-8 animate-spin my-12 text-[#D7E600]" />}
            className="flex flex-col gap-4 pb-16 w-full items-center pt-4"
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <Page 
                key={`page_${index + 1}`} 
                pageNumber={index + 1} 
                renderTextLayer={false} 
                renderAnnotationLayer={false}
                width={calculatedPageWidth}
                className="shadow-[0_4px_16px_rgba(0,0,0,0.25)] mb-4 rounded-sm transition-all"
              />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}

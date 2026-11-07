'use client';

import { useEffect, useState, useRef, useCallback } from "react";
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewportDims, setViewportDims] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 380,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const saveLastRead = useCallback((pageToSave: number, totalPages?: number) => {
    if (!file) return;
    try {
      localStorage.setItem('semkit_last_read', JSON.stringify({
        file,
        title: title || 'Lecture Notes',
        page: pageToSave,
        total: totalPages || numPages || 1,
        timestamp: Date.now()
      }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('semkit_last_read_updated'));
      }
    } catch(e) {}
  }, [file, title, numPages]);

  // References for 120 FPS hardware-accelerated pan and zoom gestures
  const scaleRef = useRef<number>(1.0);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch gesture state
  const touchModeRef = useRef<'none' | 'pan' | 'pinch'>('none');
  const startTouchesRef = useRef<{ x: number; y: number }[]>([]);
  const startDistanceRef = useRef<number>(0);
  const startScaleRef = useRef<number>(1.0);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Double tap tracking
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update viewport dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      if (viewportRef.current) {
        setViewportDims({
          width: viewportRef.current.clientWidth || window.innerWidth,
          height: viewportRef.current.clientHeight || window.innerHeight,
        });
      } else {
        setViewportDims({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  // Sync fullscreen class on body to completely hide outside elements
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

  // Load PDF from Capacitor Filesystem or web cache
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
          setDataUri(`data:application/pdf;base64,${result.data}`);
        } else {
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
    const targetPage = parseInt(searchParams.get('page') || '1', 10);
    setTimeout(() => {
      const estimatedPageHeight = basePageWidth * 1.414 + 16;
      if (targetPage > 1 && numPages && targetPage <= numPages) {
        const vpW = viewportRef.current?.clientWidth || viewportDims.width;
        const initialX = Math.max(0, (vpW - basePageWidth) / 2);
        const initialY = -((targetPage - 1) * estimatedPageHeight) + 16;
        applyTransform({ x: initialX, y: initialY }, 1.0, true);
        setCurrentPage(targetPage);
        saveLastRead(targetPage, numPages);
      } else {
        centerDocument(1.0);
        saveLastRead(1, numPages);
      }
    }, 60);
  }

  const handleOpenExternally = async () => {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { FileOpener } = await import('@capacitor-community/file-opener');
      const { uri } = await Filesystem.getUri({ path: `pdf_cache/${file}`, directory: Directory.Data });
      await FileOpener.open({ filePath: uri });
    } catch(e) { console.error(e); }
  };

  // Base rendered width for PDF pages (crisp high-DPI canvas)
  const basePageWidth = Math.min(Math.max(viewportDims.width - 24, 340), 650);

  // Directly applies CSS translate & scale transform on the content DOM node
  const applyTransform = useCallback((pan: { x: number; y: number }, s: number, animated = false) => {
    if (!contentRef.current) return;
    if (animated) {
      contentRef.current.style.transition = 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      contentRef.current.style.transition = 'none';
    }
    contentRef.current.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${s})`;
    scaleRef.current = s;
    panRef.current = pan;
  }, []);

  // Compute boundaries so the left, right, top, and bottom edges are always fully reachable
  const getBounds = useCallback((s: number) => {
    const vpW = viewportDims.width;
    const vpH = viewportDims.height;
    const contentW = basePageWidth * s;
    const contentH = (contentRef.current?.offsetHeight || 1000) * (s / (scaleRef.current || 1));

    let minX: number;
    let maxX: number;

    if (contentW <= vpW) {
      // Content fits horizontally: center it
      minX = (vpW - contentW) / 2;
      maxX = minX;
    } else {
      // Content wider than viewport: allows panning from full left edge (8px) to full right edge
      minX = vpW - contentW - 12;
      maxX = 12;
    }

    let minY: number;
    let maxY: number;

    if (contentH <= vpH) {
      minY = 16;
      maxY = 16;
    } else {
      minY = vpH - contentH - 40;
      maxY = 16;
    }

    return { minX, maxX, minY, maxY };
  }, [viewportDims, basePageWidth]);

  // Center document horizontally at a given scale
  const centerDocument = useCallback((s: number) => {
    const vpW = viewportRef.current?.clientWidth || viewportDims.width;
    const contentW = basePageWidth * s;
    const initialX = Math.max(0, (vpW - contentW) / 2);
    const initialY = 16;
    applyTransform({ x: initialX, y: initialY }, s, true);
    setScale(s);
  }, [viewportDims, basePageWidth, applyTransform]);

  // -------------------------------------------------------------
  // TOUCH GESTURES (IMAGE-STYLE PINCH TO ZOOM & 2D SMOOTH PANNING)
  // -------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Pinch gesture start
      touchModeRef.current = 'pinch';
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      startDistanceRef.current = dist;
      startScaleRef.current = scaleRef.current;
      startPanRef.current = { ...panRef.current };

      const rect = viewportRef.current?.getBoundingClientRect();
      const offsetX = rect ? rect.left : 0;
      const offsetY = rect ? rect.top : 0;

      pinchCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2 - offsetX,
        y: (t1.clientY + t2.clientY) / 2 - offsetY,
      };

      if (contentRef.current) {
        contentRef.current.style.transition = 'none';
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const distFromLastTap = Math.hypot(
        touch.clientX - lastTapPosRef.current.x,
        touch.clientY - lastTapPosRef.current.y
      );

      // Check double-tap: zoom in or reset
      if (now - lastTapTimeRef.current < 320 && distFromLastTap < 40) {
        lastTapTimeRef.current = 0;
        const rect = viewportRef.current?.getBoundingClientRect();
        const tapX = touch.clientX - (rect ? rect.left : 0);
        const tapY = touch.clientY - (rect ? rect.top : 0);

        if (scaleRef.current > 1.2) {
          // Reset to 1.0x
          centerDocument(1.0);
        } else {
          // Smooth zoom to 2.2x centered on tap location
          const targetScale = 2.2;
          const bounds = getBounds(targetScale);
          const currentPan = panRef.current;
          let targetX = tapX - (tapX - currentPan.x) * (targetScale / scaleRef.current);
          let targetY = tapY - (tapY - currentPan.y) * (targetScale / scaleRef.current);

          targetX = Math.min(Math.max(targetX, bounds.minX), bounds.maxX);
          targetY = Math.min(Math.max(targetY, bounds.minY), bounds.maxY);

          applyTransform({ x: targetX, y: targetY }, targetScale, true);
          setScale(targetScale);
        }
        return;
      }

      lastTapTimeRef.current = now;
      lastTapPosRef.current = { x: touch.clientX, y: touch.clientY };

      // Normal single finger pan start
      touchModeRef.current = 'pan';
      startTouchesRef.current = [{ x: touch.clientX, y: touch.clientY }];
      startPanRef.current = { ...panRef.current };

      if (contentRef.current) {
        contentRef.current.style.transition = 'none';
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchModeRef.current === 'pinch' && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      if (startDistanceRef.current > 0) {
        // High-sensitivity natural zoom curve (just like photo gallery zoom)
        const distanceRatio = dist / startDistanceRef.current;
        const scaleFactor = Math.pow(distanceRatio, 1.25);
        let nextScale = startScaleRef.current * scaleFactor;
        nextScale = Math.min(Math.max(nextScale, 0.75), 4.2);

        // Zoom towards pinch midpoint
        const midX = pinchCenterRef.current.x;
        const midY = pinchCenterRef.current.y;
        const startPan = startPanRef.current;
        const nextPanX = midX - (midX - startPan.x) * (nextScale / startScaleRef.current);
        const nextPanY = midY - (midY - startPan.y) * (nextScale / startScaleRef.current);

        applyTransform({ x: nextPanX, y: nextPanY }, nextScale, false);
      }
    } else if (touchModeRef.current === 'pan' && e.touches.length === 1) {
      const touch = e.touches[0];
      const startT = startTouchesRef.current[0];
      if (!startT) return;

      const deltaX = touch.clientX - startT.x;
      const deltaY = touch.clientY - startT.y;

      let nextPanX = startPanRef.current.x;
      let nextPanY = startPanRef.current.y + deltaY;

      // Allow full horizontal moving left or right when zoomed in
      if (scaleRef.current > 1.05) {
        nextPanX = startPanRef.current.x + deltaX;
      }

      applyTransform({ x: nextPanX, y: nextPanY }, scaleRef.current, false);
    }
  };

  const handleTouchEnd = () => {
    touchModeRef.current = 'none';
    const currentScale = scaleRef.current;

    // Bounce back if scale is below 1.0x
    if (currentScale < 1.0) {
      centerDocument(1.0);
      return;
    }

    // Clamp pan position to valid boundaries
    const bounds = getBounds(currentScale);
    let clampedX = panRef.current.x;
    let clampedY = panRef.current.y;

    clampedX = Math.min(Math.max(clampedX, bounds.minX), bounds.maxX);
    clampedY = Math.min(Math.max(clampedY, bounds.minY), bounds.maxY);

    applyTransform({ x: clampedX, y: clampedY }, currentScale, true);
    setScale(Number(currentScale.toFixed(2)));

    // Track and save current page position
    const estimatedPageHeight = basePageWidth * 1.414 + 16;
    const scrolledY = Math.max(0, -clampedY);
    const curPage = Math.min(Math.max(1, Math.round(scrolledY / (estimatedPageHeight * currentScale)) + 1), numPages || 1);
    setCurrentPage(curPage);
    saveLastRead(curPage, numPages || 1);
  };

  // Button Zoom Handlers
  const handleZoomIn = () => {
    const nextScale = Math.min(Number((scaleRef.current + 0.4).toFixed(2)), 4.0);
    const bounds = getBounds(nextScale);
    const vpW = viewportDims.width;
    const vpH = viewportDims.height;
    
    // Zoom centered on viewport center
    const centerX = vpW / 2;
    const centerY = vpH / 2;
    let nextPanX = centerX - (centerX - panRef.current.x) * (nextScale / scaleRef.current);
    let nextPanY = centerY - (centerY - panRef.current.y) * (nextScale / scaleRef.current);

    nextPanX = Math.min(Math.max(nextPanX, bounds.minX), bounds.maxX);
    nextPanY = Math.min(Math.max(nextPanY, bounds.minY), bounds.maxY);

    applyTransform({ x: nextPanX, y: nextPanY }, nextScale, true);
    setScale(nextScale);
  };

  const handleZoomOut = () => {
    const nextScale = Math.max(Number((scaleRef.current - 0.4).toFixed(2)), 1.0);
    if (nextScale <= 1.0) {
      centerDocument(1.0);
    } else {
      const bounds = getBounds(nextScale);
      const vpW = viewportDims.width;
      const vpH = viewportDims.height;
      const centerX = vpW / 2;
      const centerY = vpH / 2;
      let nextPanX = centerX - (centerX - panRef.current.x) * (nextScale / scaleRef.current);
      let nextPanY = centerY - (centerY - panRef.current.y) * (nextScale / scaleRef.current);

      nextPanX = Math.min(Math.max(nextPanX, bounds.minX), bounds.maxX);
      nextPanY = Math.min(Math.max(nextPanY, bounds.minY), bounds.maxY);

      applyTransform({ x: nextPanX, y: nextPanY }, nextScale, true);
      setScale(nextScale);
    }
  };

  const handleResetZoom = () => {
    centerDocument(1.0);
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

  return (
    <div 
      className={
        isFullscreen 
          ? "fixed inset-0 z-[99999] w-screen h-screen bg-[#111111] flex flex-col overflow-hidden" 
          : "h-full flex flex-col bg-[var(--paper-deep)] relative overflow-hidden"
      }
    >
      {/* Top Controls Header Bar */}
      <div className="bg-[var(--ink)] text-[var(--paper)] flex items-center justify-between px-2.5 py-2.5 shadow-md z-20 sticky top-0 shrink-0 select-none">
        <div className="flex items-center min-w-0 mr-2 flex-1">
          <button 
            onClick={handleBack} 
            className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="font-semibold text-[14px] ml-1 truncate text-white">{title || 'Document'}</h1>
        </div>

        {/* Zoom Controls & Box-Shaped Fullscreen Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Page Counter Indicator */}
          {numPages ? (
            <div className="font-mono text-[10.5px] font-bold text-white/90 bg-white/10 px-2 py-1 rounded-md border border-white/15 shrink-0">
              {currentPage} / {numPages}
            </div>
          ) : null}

          {/* Zoom Buttons with percentage indicator */}
          <div className="flex items-center bg-white/15 rounded-lg p-0.5 border border-white/20">
            <button 
              onClick={handleZoomOut}
              className="w-7 h-7 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 rounded active:scale-90 transition-all cursor-pointer"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOutIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleResetZoom}
              className="px-2 text-[11px] font-mono font-bold text-white/90 hover:text-white transition-colors cursor-pointer"
              title="Reset zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button 
              onClick={handleZoomIn}
              className="w-7 h-7 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 rounded active:scale-90 transition-all cursor-pointer"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomInIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Box-shaped Fullscreen Toggle Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="w-8 h-8 rounded-lg border-[1.5px] border-white/40 bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white shadow-sm transition-all cursor-pointer"
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

      {/* Main Viewport Container */}
      <div 
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="flex-1 relative w-full h-full overflow-hidden select-none bg-[#111111]"
        style={{ touchAction: 'none' }}
      >
        {!dataUri && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center z-10">
            <Loader2Icon className="w-8 h-8 animate-spin text-[#D7E600]" />
            <span className="text-[13px] text-zinc-300 font-medium">Opening document...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 z-10">
            <span className="text-[14px] font-medium text-white">Failed to load internal reader.</span>
            <div className="flex gap-2">
              <button onClick={() => router.back()} className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-sm font-bold">Go Back</button>
              <button onClick={handleOpenExternally} className="px-4 py-2 bg-[#D7E600] text-black rounded-lg text-sm font-bold">
                Open Externally
              </button>
            </div>
          </div>
        )}

        {/* Scaled & Panned Content Wrapper (Transforms executed at 60-120fps by GPU) */}
        {dataUri && !error && (
          <div
            ref={contentRef}
            className="absolute top-0 left-0 flex flex-col gap-5 pb-24 items-center will-change-transform"
            style={{ 
              transformOrigin: '0 0',
              width: `${basePageWidth}px` 
            }}
          >
            <Document 
              file={dataUri} 
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={() => setError(true)}
              loading={<Loader2Icon className="w-8 h-8 animate-spin my-16 text-[#D7E600]" />}
              className="flex flex-col gap-4 items-center w-full"
            >
              {Array.from(new Array(numPages || 0), (el, index) => (
                <Page 
                  key={`page_${index + 1}`} 
                  pageNumber={index + 1} 
                  renderTextLayer={false} 
                  renderAnnotationLayer={false}
                  width={basePageWidth}
                  className="shadow-[0_4px_20px_rgba(0,0,0,0.5)] mb-3 rounded-[3px] bg-white overflow-hidden"
                />
              ))}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}

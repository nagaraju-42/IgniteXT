'use client';

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeftIcon, Loader2Icon } from "lucide-react";
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
          // Web usually returns a blob or base64 depending on setup
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

  if (!file) {
    return <div className="p-8 text-center bg-[var(--paper)] h-full">No file specified</div>;
  }

  return (
    <div className="h-full flex flex-col bg-[var(--paper-deep)] relative">
      <div className="bg-[var(--ink)] text-[var(--paper)] flex items-center px-2 py-3 shadow-md z-10 sticky top-0">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center shrink-0">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-[15px] ml-1 truncate pr-4">{title || 'Document'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto relative w-full flex flex-col items-center">
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
            loading={<Loader2Icon className="w-8 h-8 animate-spin my-12" />}
            className="flex flex-col gap-4 pb-12 w-full items-center pt-4"
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <Page 
                key={`page_${index + 1}`} 
                pageNumber={index + 1} 
                renderTextLayer={false} 
                renderAnnotationLayer={false}
                width={Math.min(window.innerWidth - 32, 600)} 
                className="shadow-[0_2px_10px_rgba(0,0,0,0.1)] mb-4"
              />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}

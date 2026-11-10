'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useIsNativeApp } from '@/lib/useIsNativeApp';
import { WebRead } from '@/components/web/WebRead';

// We MUST dynamically import the PDF viewer component so Next.js doesn't try to render it on the server during build
// Server-side rendering causes the "DOMMatrix is not defined" crash!
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <div className="p-12 text-center text-[var(--ink-soft)] font-medium">Loading PDF Engine...</div>
});

export default function ReadPage() {
  const nativeMode = useIsNativeApp();

  return (
    <Suspense fallback={<div className="p-12 text-center">Loading viewer...</div>}>
      {nativeMode ? <PDFViewer /> : <WebRead />}
    </Suspense>
  );
}

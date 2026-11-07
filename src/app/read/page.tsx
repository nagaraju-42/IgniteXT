'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// We MUST dynamically import the PDF viewer component so Next.js doesn't try to render it on the server during build
// Server-side rendering causes the "DOMMatrix is not defined" crash!
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <div className="p-12 text-center text-[var(--ink-soft)] font-medium">Loading PDF Engine...</div>
});

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading viewer...</div>}>
      <PDFViewer />
    </Suspense>
  );
}

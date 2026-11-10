import { NextRequest, NextResponse } from 'next/server';
import { getDirectR2Url } from '@/lib/pdfUrl';

export const dynamic = 'force-dynamic';

/**
 * Same-origin PDF proxy fallback for non-R2 external PDFs or forced downloads.
 * Supports HTTP Range requests (206 Partial Content) for fast page-by-page streaming.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawUrl = searchParams.get('url');
  const key = searchParams.get('key');
  const download = searchParams.get('download') === '1';
  const filename = searchParams.get('filename') || 'SemKit_Notes.pdf';

  const targetUrl = rawUrl || (key ? getDirectR2Url(key) : '');
  if (!targetUrl || (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://'))) {
    return NextResponse.json({ error: 'Invalid PDF target' }, { status: 400 });
  }

  try {
    const forwardHeaders = new Headers();
    const range = req.headers.get('range');
    if (range) {
      forwardHeaders.set('Range', range);
    }

    const upstream = await fetch(targetUrl, { headers: forwardHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned HTTP ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/pdf');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);

    const cleanName = filename.replace(/[/\\?%*:|"<>]+/g, '_');
    headers.set(
      'Content-Disposition',
      download ? `attachment; filename="${cleanName}"` : `inline; filename="${cleanName}"`
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PDF proxy failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

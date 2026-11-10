/**
 * Web & R2 PDF URL resolver.
 *
 * Cloudflare R2 public `.r2.dev` buckets omit CORS headers, so on the Website we route
 * R2 keys through same-origin `/r2/...` (handled via Next.js rewrites) for instant
 * byte-range PDF streaming (`206 Partial Content`) with zero CORS errors or forced downloads.
 */

export const DEFAULT_R2_PUBLIC_URL = 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev';

/** Strips trailing slashes from R2 base URL. */
export function getR2BaseUrl(): string {
  return (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_PUBLIC_URL).replace(/\/+$/, '');
}

/** Resolves direct public Cloudflare R2 URL (used for native/external opens). */
export function getDirectR2Url(fileUrl: string): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  const cleanKey = fileUrl.replace(/^\/+/, '');
  return `${getR2BaseUrl()}/${encodeURI(cleanKey)}`;
}

/**
 * Resolves a same-origin streaming URL for in-browser PDF auto-preview.
 * Avoids R2 CORS blocks and Vercel serverless payload limits via Next.js `/r2/` rewrite.
 */
export function getWebPdfStreamUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('/r2/') || fileUrl.startsWith('/api/pdf')) {
    return fileUrl;
  }

  const r2Base = getR2BaseUrl();
  if (fileUrl.startsWith(r2Base)) {
    const rel = fileUrl.slice(r2Base.length).replace(/^\/+/, '');
    return `/r2/${encodeURI(rel)}`;
  }

  // Handle any other r2.dev bucket URL cleanly or third-party URL via fallback proxy
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return `/api/pdf?url=${encodeURIComponent(fileUrl)}`;
  }

  const cleanKey = fileUrl.replace(/^\/+/, '');
  return `/r2/${encodeURI(cleanKey)}`;
}

/** Triggers a clean client-side PDF download without opening away from the reader. */
export async function downloadWebPdf(fileUrl: string, suggestedTitle: string): Promise<void> {
  const streamUrl = getWebPdfStreamUrl(fileUrl);
  const safeName = `${(suggestedTitle || 'SemKit_Notes').replace(/[/\\?%*:|"<>]+/g, '_')}.pdf`;

  const response = await fetch(streamUrl);
  if (!response.ok) {
    window.open(getDirectR2Url(fileUrl), '_blank');
    return;
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

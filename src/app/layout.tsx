import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SemKit — Exam Prep Notes & Instant PDF Reader",
  description: "Free B.Tech notes, PYQs and exam updates for engineering students — instant online preview on mobile and laptop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SemKit",
  },
};

export const viewport: Viewport = {
  themeColor: "#D7E600",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/icon-192x192.png" />
        <link rel="stylesheet" href="/pdf-annotation.css" />
        <link rel="stylesheet" href="/pdf-text.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[var(--paper)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

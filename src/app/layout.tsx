import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { HeaderBar } from "@/components/HeaderBar";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import "./globals.css";

export const metadata: Metadata = {
  title: "SemKit",
  description: "Free B.Tech notes, PYQs and exam updates for engineering students",
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
  maximumScale: 1,
  userScalable: false,
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
        <div className="flex justify-center h-screen h-[100dvh] overflow-hidden bg-[var(--paper)]">
          <div className="w-full max-w-[428px] h-full border-x-[3px] border-[var(--ink)] bg-[var(--paper-card)] flex flex-col shadow-[6px_6px_0_var(--paper-deep)] md:my-auto md:h-[94vh] md:rounded-[34px] md:border-y-[3px] overflow-hidden relative">
            {/* App Top Fixed */}
            <HeaderBar />

            {/* Scrollable Screen Content */}
            <main className="flex-1 overflow-y-auto no-scrollbar">
              {children}
            </main>

            {/* Always Fixed Bottom Navigation Bar */}
            <BottomNav />
            
            {/* Floating Feedback Widget */}
            <FeedbackWidget />
          </div>
        </div>
      </body>
    </html>
  );
}

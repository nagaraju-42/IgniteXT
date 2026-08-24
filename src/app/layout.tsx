import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { StudentGateModal } from "@/components/StudentGate";
import { LiveCounter } from "@/components/LiveCounter";
import "./globals.css";

export const metadata: Metadata = {
  title: "IgniteXT",
  description: "Free B.Tech notes, PYQs and exam updates for engineering students",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IgniteXT",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[var(--paper)]">
        <div className="flex justify-center min-h-screen">
          <div className="w-full max-w-[428px] border-x-[3px] border-[var(--ink)] bg-[var(--paper-card)] flex flex-col shadow-[6px_6px_0_var(--paper-deep)] md:my-8 md:rounded-[34px] md:border-y-[3px] md:overflow-hidden relative">
            {/* App Top */}
            <div className="px-[18px] pb-3 pt-4 flex items-center justify-between border-b border-[var(--rule)] bg-[var(--ink)]">
              <img src="/logo.png" alt="IgniteXT Logo" className="h-[28px] object-contain" />
              <LiveCounter />
            </div>

            {/* Screen Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
              <StudentGateModal />
            </div>

            {/* Tab Bar */}
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}

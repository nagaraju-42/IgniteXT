'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, GridIcon, BookmarkIcon, UserIcon } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  // Hide on admin routes so it doesn't confusingly redirect to student views
  if (pathname.startsWith('/admin') || pathname.startsWith('/community')) {
    return null;
  }

  const getLinkClass = (path: string) => {
    const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
    return `flex flex-col items-center gap-1 text-[9.5px] font-bold transition-all ${
      isActive ? 'text-[var(--ink)] scale-105' : 'text-[var(--ink-faint)] hover:text-[var(--ink-soft)]'
    }`;
  };

  return (
    <div className="shrink-0 flex justify-around px-2.5 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-[var(--rule)] bg-[var(--paper-card)] z-50 select-none shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <Link href="/" className={getLinkClass('/')}>
        <HomeIcon className="w-[19px] h-[19px]" />
        <span>Home</span>
      </Link>
      <Link href="/browse" className={getLinkClass('/browse')}>
        <GridIcon className="w-[19px] h-[19px]" />
        <span>Browse</span>
      </Link>
      <Link href="/saved" className={getLinkClass('/saved')}>
        <BookmarkIcon className="w-[19px] h-[19px]" />
        <span>Saved</span>
      </Link>
      <Link href="/profile" className={getLinkClass('/profile')}>
        <UserIcon className="w-[19px] h-[19px]" />
        <span>Profile</span>
      </Link>
    </div>
  );
}

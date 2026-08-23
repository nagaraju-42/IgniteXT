'use client'

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
    return `flex flex-col items-center gap-1 text-[9.5px] font-medium transition-colors ${
      isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'
    }`;
  };

  return (
    <div className="flex justify-around px-2.5 pt-3 pb-2.5 border-t border-[var(--rule)] bg-[var(--paper-card)] pb-safe">
      <Link href="/" className={getLinkClass('/')}>
        <HomeIcon className="w-[19px] h-[19px]" />
        Home
      </Link>
      <Link href="/browse" className={getLinkClass('/browse')}>
        <GridIcon className="w-[19px] h-[19px]" />
        Browse
      </Link>
      <Link href="/saved" className={getLinkClass('/saved')}>
        <BookmarkIcon className="w-[19px] h-[19px]" />
        Saved
      </Link>
      <Link href="/profile" className={getLinkClass('/profile')}>
        <UserIcon className="w-[19px] h-[19px]" />
        Profile
      </Link>
    </div>
  );
}

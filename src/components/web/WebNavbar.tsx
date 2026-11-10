'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SearchIcon,
  MenuIcon,
  XIcon,
  BookOpenIcon,
  GridIcon,
  BookmarkIcon,
  MessageSquareIcon,
  UserIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/components/OnboardingModal';
import { deriveSubjectShortCode } from '@/lib/subjectNaming';
import { readStudentSpaceProfile } from '@/components/web/WebSpaceCard';

export function WebNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [liveCount, setLiveCount] = useState<number>(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Instant quick-search state
  const [searchQuery, setSearchQuery] = useState('');
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const loadProfile = () => {
    setProfile(readStudentSpaceProfile());
  };

  useEffect(() => {
    loadProfile();
    const handleProfileChange = () => loadProfile();
    window.addEventListener('semkit_profile_changed', handleProfileChange);
    window.addEventListener('ignitext_profile_changed', handleProfileChange);

    // Load subjects index for instant header autocomplete
    supabase
      .from('subjects')
      .select('id, name, code, semester')
      .eq('is_active', true)
      .order('name')
      .then(({ data }: { data: any[] | null }) => {
        if (data) setAllSubjects(data);
      });

    // Live presence counter shared with mobile app
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel('global_room', {
        config: { presence: { key: 'web_user' } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!channel) return;
          const state = channel.presenceState();
          let count = 0;
          for (const key in state) {
            count += (state[key] as unknown[]).length;
          }
          setLiveCount(Math.max(1, count));
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED' && channel) {
            await channel.track({
              platform: 'web',
              online_at: new Date().toISOString(),
            });
          }
        });
    } catch {
      // Presence optional
    }

    return () => {
      window.removeEventListener('semkit_profile_changed', handleProfileChange);
      window.removeEventListener('ignitext_profile_changed', handleProfileChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchFocused(false);
  }, [pathname]);

  const quickMatches = React.useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return [];
    return allSubjects
      .filter((s) => {
        const name = (s.name || '').toLowerCase();
        const code = (s.code || '').toLowerCase();
        const short = deriveSubjectShortCode(s.name, s.code).toLowerCase();
        return name.includes(term) || code.includes(term) || short.includes(term);
      })
      .slice(0, 6);
  }, [searchQuery, allSubjects]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFocused(false);
    if (!profile) {
      router.push('/#web-set-space');
      return;
    }
    const q = searchQuery.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const navItems = [
    { href: '/', label: 'Exam Hub', icon: BookOpenIcon },
    { href: '/browse', label: 'Browse All', icon: GridIcon },
    { href: '/saved', label: 'Bookmarks', icon: BookmarkIcon },
    { href: '/support', label: 'Feedback', icon: MessageSquareIcon },
  ];

  const isActivePath = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header
      data-hide-on-pdf-fullscreen="true"
      className="sticky top-0 z-50 bg-[var(--ink)] text-[var(--paper)] border-b-2 border-[var(--ink)] shadow-sm select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-5">
        {/* Left: Brand Logo + Live Counter */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="SemKit Logo" className="h-8 w-8 object-contain" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-black text-[22px] leading-none tracking-tight text-[var(--paper)]">
                  SemKit
                </span>
                <span className="hidden sm:inline-block font-mono text-[9.5px] font-black bg-[#D7E600] text-[#201C14] px-1.5 py-0.5 rounded uppercase tracking-wider">
                  ONLINE STUDY
                </span>
              </div>
            </div>
          </Link>

          <div
            className="hidden sm:flex items-center gap-1.5 font-mono text-[10.5px] font-bold bg-[#142818] text-[#4ADE80] border border-[#22543D] px-2.5 py-1 rounded-full"
            title="Students studying online right now"
          >
            <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
            <span>{liveCount} LIVE</span>
          </div>
        </div>

        {/* Center: Instant Quick Search (Desktop/Tablet) */}
        <div ref={searchWrapRef} className="hidden md:block flex-1 max-w-md relative">
          <form onSubmit={handleSearchSubmit} className="relative">
            <SearchIcon className="w-4 h-4 text-[var(--ink-faint)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Quick jump to subject (e.g. CIS, WT, OS, ML)..."
              className="w-full bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] pl-10 pr-4 py-2 rounded-xl text-[13px] font-medium border-2 border-transparent focus:border-[#D7E600] outline-none transition-all"
            />
          </form>

          {/* Live Autocomplete Dropdown */}
          {searchFocused && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-[var(--paper)] border-2 border-[var(--ink)] rounded-2xl shadow-[4px_4px_0_var(--ink)] overflow-hidden z-50 text-[var(--ink)]">
              {!profile ? (
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full px-4 py-3 text-left text-[12.5px] font-bold hover:bg-[#D7E600]/25 cursor-pointer flex items-center justify-between"
                >
                  <span>Set up your Space first to unlock search →</span>
                </button>
              ) : quickMatches.length > 0 ? (
                <div className="divide-y divide-[var(--rule)]">
                  {quickMatches.map((sub) => {
                    const code = deriveSubjectShortCode(sub.name, sub.code);
                    return (
                      <Link
                        key={sub.id}
                        href={`/subject?id=${sub.id}`}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#D7E600]/25 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-[13px] truncate">{sub.name}</div>
                          <div className="font-mono text-[10px] text-[var(--ink-soft)]">
                            {code} · Sem {sub.semester}
                          </div>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-[var(--ink-soft)] shrink-0" />
                      </Link>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="w-full px-3.5 py-2 text-left text-[11.5px] font-bold bg-[var(--paper-card)] hover:bg-[var(--paper-deep)] text-[var(--ink)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Search all notes & PYQs for "{searchQuery}"</span>
                    <SearchIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full px-4 py-3 text-left text-[12.5px] font-medium hover:bg-[var(--paper-card)] cursor-pointer"
                >
                  Search all notes matching <strong className="font-bold">"{searchQuery}"</strong> →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Desktop Nav Links + Profile Pill + Mobile Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <nav className="hidden lg:flex items-center gap-1 mr-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-bold transition-all ${
                    active
                      ? 'bg-[#D7E600] text-[#201C14]'
                      : 'text-[var(--paper)]/80 hover:text-[var(--paper)] hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Profile / Academic Space Pill */}
          <Link
            href="/profile"
            className="flex items-center gap-1.5 bg-[var(--paper-card)] hover:bg-[#D7E600] text-[var(--ink)] font-mono font-bold text-[11px] px-3 py-1.5 rounded-full border border-[var(--paper)] transition-colors"
            title="Manage your semester, regulation, or admin access"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>
              {profile?.roll
                ? `${profile.roll}`
                : profile
                ? `${profile.branch_code || 'CSE'} · Sem ${profile.sem}`
                : 'Enter Roll No'}
            </span>
          </Link>

          {/* Mobile Search Shortcut */}
          <Link
            href="/search"
            aria-label="Search"
            className="md:hidden w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-[var(--paper)]"
          >
            <SearchIcon className="w-4 h-4" />
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle Menu"
            className="lg:hidden w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-[var(--paper)] cursor-pointer"
          >
            {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile/Tablet Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[var(--paper)] text-[var(--ink)] border-t-2 border-[var(--ink)] px-4 py-3 shadow-lg">
          <div className="flex flex-col gap-1.5 max-w-7xl mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-[13.5px] border-[1.5px] transition-all ${
                    active
                      ? 'bg-[#D7E600] border-[var(--ink)] text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                      : 'bg-[var(--paper-card)] border-[var(--rule-strong)] text-[var(--ink)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  <ChevronRightIcon className="w-4 h-4 opacity-50" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

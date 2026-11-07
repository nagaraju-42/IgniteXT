'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StudentProfile } from './OnboardingModal';

export function HeaderBar() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [liveCount, setLiveCount] = useState<number>(2);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const router = useRouter();

  const supabase = createClient();

  const loadProfile = () => {
    try {
      const saved = localStorage.getItem('semkit_profile') || localStorage.getItem('ignitext_profile');
      if (saved) {
        setProfile(JSON.parse(saved));
        return;
      }
      const match = document.cookie.match(/(?:^|; )(?:semkit_profile|ignitext_profile)=([^;]*)/);
      if (match && match[1]) {
        setProfile(JSON.parse(decodeURIComponent(match[1])));
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadProfile();

    const handleProfileChange = () => loadProfile();
    window.addEventListener('semkit_profile_changed', handleProfileChange);
    window.addEventListener('ignitext_profile_changed', handleProfileChange);

    setIsOnline(navigator.onLine);
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    // Supabase presence for LIVE counter
    try {
      const channel = supabase.channel('global_room', {
        config: { presence: { key: 'user' } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          let count = 0;
          for (const key in state) {
            count += (state[key] as any[]).length;
          }
          setLiveCount(Math.max(1, count));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            const currentProfile = profile;
            await channel.track({
              roll: currentProfile?.roll || 'guest',
              branch: currentProfile?.branch_code || 'all',
              online_at: new Date().toISOString(),
            });
          }
        });

      return () => {
        window.removeEventListener('semkit_profile_changed', handleProfileChange);
        window.removeEventListener('ignitext_profile_changed', handleProfileChange);
        window.removeEventListener('online', setOnline);
        window.removeEventListener('offline', setOffline);
        supabase.removeChannel(channel);
      };
    } catch (err) {
      return () => {
        window.removeEventListener('semkit_profile_changed', handleProfileChange);
        window.removeEventListener('ignitext_profile_changed', handleProfileChange);
        window.removeEventListener('online', setOnline);
        window.removeEventListener('offline', setOffline);
      };
    }
  }, []);

  return (
    <div data-hide-on-pdf-fullscreen="true" className="shrink-0 px-[14px] pb-3 pt-3 flex items-center justify-between border-b border-[var(--rule)] bg-[var(--ink)] z-40 select-none">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="SemKit Logo" className="h-[28px] object-contain" />
        <span className="font-display font-black text-[18px] text-[var(--paper)] tracking-tight">
          SemKit
        </span>
      </Link>

      {/* Right side badges */}
      <div className="flex items-center gap-2">
        {/* Roll Number / Space Badge - clicking goes to profile */}
        {profile ? (
          <Link
            href="/profile"
            className="bg-[var(--paper-deep)] hover:bg-[var(--paper)] text-[var(--ink-soft)] hover:text-[var(--ink)] font-bold font-mono text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[var(--rule-strong)] transition-all cursor-pointer"
            title={`Space: ${profile.reg_code} ${profile.branch_code} Sem ${profile.sem} - Click to manage in Profile`}
          >
            👋 HI, {profile.roll}
          </Link>
        ) : (
          <Link
            href="/profile"
            className="border border-[rgba(255,255,255,0.25)] text-[rgba(255,255,255,0.8)] hover:border-white font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer"
          >
            Enter Roll No
          </Link>
        )}

        {/* Live Status Badge */}
        {isOnline ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#10b981]/15 border border-[#10b981]/30 rounded-full">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </div>
            <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wide">
              {liveCount} LIVE
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2C2C2C] border border-[#404040] rounded-full">
            <div className="w-2 h-2 rounded-full bg-[#808080]"></div>
            <span className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide">
              OFFLINE
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

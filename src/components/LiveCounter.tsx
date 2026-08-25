'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LiveCounter() {
  const [count, setCount] = useState(1);
  const [isOnline, setIsOnline] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for profile cookie
    try {
      const match = document.cookie.match(/(?:^|; )ignitext_profile=([^;]*)/);
      if (match && match[1]) {
        setProfile(JSON.parse(decodeURIComponent(match[1])));
      }
    } catch(e) {}

    if (!navigator.onLine) return;

    const channel = supabase.channel('global_room', {
      config: { presence: { key: 'user' } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let total = 0;
        for (const id in state) {
          total += state[id].length;
        }
        setCount(Math.max(1, total));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // If profile exists, track their roll and branch!
          const trackData = profile ? {
            roll: profile.roll,
            branch: profile.branch_code,
            sem: profile.sem,
            online_at: new Date().toISOString()
          } : { 
            is_anonymous: true,
            online_at: new Date().toISOString() 
          };
          
          await channel.track(trackData);
        }
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, [profile?.roll]); // re-run if profile loads

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2C2C2C] border border-[#404040] rounded-full">
        <div className="w-2 h-2 rounded-full bg-[#808080]"></div>
        <span className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide">Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {profile && (
        <span className="text-[10px] font-extrabold text-[var(--ink-soft)] bg-[var(--paper-deep)] px-2.5 py-1 rounded-full border border-[var(--rule-strong)] shadow-sm uppercase tracking-wide">
          👋 Hi, {profile.roll.slice(0,6)}...
        </span>
      )}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded-full">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
        </div>
        <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wide">
          {count} Live
        </span>
      </div>
    </div>
  );
}

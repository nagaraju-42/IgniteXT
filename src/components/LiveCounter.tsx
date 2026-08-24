'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LiveCounter() {
  const [count, setCount] = useState(1);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) return;

    const supabase = createClient();
    const room = supabase.channel('global_room');

    room
      .on('presence', { event: 'sync' }, () => {
        const newState = room.presenceState();
        let total = 0;
        for (const id in newState) {
          total += newState[id].length;
        }
        setCount(Math.max(1, total));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track this specific user session
          await room.track({ 
            online_at: new Date().toISOString() 
          });
        }
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(room);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2C2C2C] border border-[#404040] rounded-full">
        <div className="w-2 h-2 rounded-full bg-[#808080]"></div>
        <span className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide">Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded-full">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
      </div>
      <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wide">
        {count} {count === 1 ? 'Student' : 'Students'} Live
      </span>
    </div>
  );
}

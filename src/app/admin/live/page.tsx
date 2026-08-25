'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ActivityIcon, UsersIcon, ClockIcon, ChevronLeftIcon, GlobeIcon, DatabaseIcon } from 'lucide-react';
import Link from 'next/link';

export default function LiveRadarPage() {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [liveStudents, setLiveStudents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const supabase = createClient();

  // Load Live Data (Presence)
  useEffect(() => {
    const channel = supabase.channel('global_room');
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const students: any[] = [];
      
      for (const id in state) {
        state[id].forEach((presence: any) => {
          if (!presence.is_anonymous && presence.roll) {
            students.push({
              ...presence,
              clientId: id
            });
          }
        });
      }
      
      // Sort by online time (newest first), safely handle missing dates
      students.sort((a, b) => {
        const timeA = a.online_at ? new Date(a.online_at).getTime() : 0;
        const timeB = b.online_at ? new Date(b.online_at).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      setLiveStudents(students);
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Load Historical Data
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('student_sessions')
      .select('*')
      .order('joined_at', { ascending: false })
      .limit(100);
      
    if (data) setHistory(data);
    setLoadingHistory(false);
  };

  const getDurationString = (start?: string, end?: string) => {
    if (!start) return 'Unknown';
    const startTime = new Date(start).getTime();
    if (isNaN(startTime)) return 'Unknown';

    const endTime = end ? new Date(end).getTime() : new Date().getTime();
    const safeEndTime = isNaN(endTime) ? new Date().getTime() : endTime;
    
    const diffMins = Math.floor((safeEndTime - startTime) / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} hr ${mins} min`;
  };

  const safeFormatTime = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const safeFormatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--paper-card)]">
      <div className="px-5 py-4 border-b border-[var(--rule)] bg-[var(--paper)]">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-soft)] mb-3 hover:text-[var(--ink)]">
          <ChevronLeftIcon className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="font-bold text-[22px] leading-tight mb-1 flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-green-500" /> Activity Radar
        </h1>
        <p className="text-[13px] text-[var(--ink-soft)]">Monitor real-time student activity and historical sessions.</p>
      </div>

      <div className="px-5 py-4 flex gap-2">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'live'
              ? 'bg-[var(--ink)] text-[var(--paper)] shadow-sm'
              : 'bg-[var(--paper-deep)] text-[var(--ink-soft)] hover:bg-[var(--rule)]'
          }`}
        >
          <GlobeIcon className="w-4 h-4" /> Live Now
          {activeTab === 'live' && (
            <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
              {liveStudents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'history'
              ? 'bg-[var(--ink)] text-[var(--paper)] shadow-sm'
              : 'bg-[var(--paper-deep)] text-[var(--ink-soft)] hover:bg-[var(--rule)]'
          }`}
        >
          <DatabaseIcon className="w-4 h-4" /> History Log
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {activeTab === 'live' && (
          <div className="flex flex-col gap-3 mt-2">
            {liveStudents.length > 0 ? (
              liveStudents.map((student, idx) => (
                <div key={idx} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                        <UsersIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--paper)] rounded-full animate-pulse"></span>
                    </div>
                    <div>
                      <div className="font-bold text-[15px] text-[var(--ink)] tracking-wide">{student.roll}</div>
                      <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5 uppercase">
                        {student.branch || 'Unknown'} • Sem {student.sem || '?'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-[12px] font-bold text-green-600 flex items-center gap-1">
                      Online
                    </div>
                    <div className="text-[10px] text-[var(--ink-faint)] mt-1 font-medium">
                      Active: {getDurationString(student.online_at)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[var(--paper-deep)]/50 mt-4">
                <GlobeIcon className="w-8 h-8 text-[var(--ink-soft)] opacity-50 mb-3" />
                <p className="font-bold text-[14px] text-[var(--ink)]">No personalized students online</p>
                <p className="text-[12px] text-[var(--ink-soft)] mt-1 max-w-[200px]">Waiting for students to open the app and broadcast their presence.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-3 mt-2">
            {loadingHistory ? (
              <div className="text-center p-8 text-[var(--ink-soft)] text-[13px] animate-pulse">Loading logs...</div>
            ) : history.length > 0 ? (
              history.map((log) => (
                <div key={log.id} className="border-[1.5px] border-[var(--rule)] rounded-xl p-3.5 bg-[var(--paper)] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[var(--paper-deep)] flex items-center justify-center shrink-0">
                        <UsersIcon className="w-4 h-4 text-[var(--ink-soft)]" />
                      </div>
                      <div>
                        <div className="font-bold text-[14px] text-[var(--ink)]">{log.roll_number}</div>
                        <div className="font-mono text-[10px] text-[var(--ink-soft)] uppercase">
                          {log.branch_code || 'Unknown'} • Sem {log.semester || '?'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end text-right">
                      <div className="text-[11px] font-bold text-[var(--ink-soft)] flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" /> 
                        {safeFormatTime(log.joined_at)}
                      </div>
                      <div className="text-[10px] text-[var(--ink-faint)] mt-1">
                        {safeFormatDate(log.joined_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] bg-[var(--paper-deep)] px-3 py-2 rounded-lg border border-[var(--rule-strong)]">
                    <div>
                      <span className="text-[var(--ink-soft)] font-medium">Session Length:</span>{' '}
                      <span className="font-bold text-[var(--ink)]">{getDurationString(log.joined_at, log.left_at)}</span>
                    </div>
                    <div>
                      {log.left_at ? (
                        <span className="text-[var(--ink-faint)]">Exited {safeFormatTime(log.left_at)}</span>
                      ) : (
                        <span className="text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Live or force closed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[var(--paper-deep)]/50 mt-4">
                <DatabaseIcon className="w-8 h-8 text-[var(--ink-soft)] opacity-50 mb-3" />
                <p className="font-bold text-[14px] text-[var(--ink)]">No history logged yet</p>
                <p className="text-[12px] text-[var(--ink-soft)] mt-1 max-w-[200px]">Historical tracking begins once you create the student_sessions table in Supabase.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

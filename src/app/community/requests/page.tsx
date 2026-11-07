'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, Loader2Icon, UploadCloudIcon, TrendingUpIcon } from "lucide-react";

export default function RequestsDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    async function loadRequests() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      // Fetch requests, joining subjects to get the subject name/code
      const { data } = await supabase
        .from('content_requests')
        .select(`
          *,
          subjects (
            name,
            code,
            unit_names
          )
        `)
        .eq('status', 'open')
        .order('request_count', { ascending: false })
        .limit(50);
        
      if (data) setRequests(data);
      setLoading(false);
    }
    loadRequests();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] min-h-screen">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center shadow-sm sticky top-0 z-10">
        <Link href="/community" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Student Requests</div>
      </div>

      <div className="flex-1 overflow-y-auto p-[18px]">
        <div className="bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 mb-5 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-full bg-[var(--hl)] flex items-center justify-center shrink-0">
            <TrendingUpIcon className="w-5 h-5 text-[var(--ink)]" />
          </div>
          <div>
            <h2 className="font-bold text-[14px]">Most Requested Content</h2>
            <p className="text-[12px] text-[var(--ink-soft)] leading-snug mt-0.5">
              These are the empty units and PYQs students are desperately clicking "I Need This" on. Upload these first to get massive downloads!
            </p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="text-center text-[var(--ink-soft)] py-10 text-[13px]">
            No pending requests! You're all caught up.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map(req => {
              const unitName = req.unit_number && req.subjects?.unit_names ? req.subjects.unit_names[req.unit_number.toString()] : null;
              
              return (
                <div key={req.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex justify-between items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-[var(--paper-deep)] text-[var(--ink-soft)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {req.subjects?.code || 'SUB'}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--red)] uppercase tracking-wider flex items-center gap-1">
                        🔥 {req.request_count} Votes
                      </span>
                    </div>
                    
                    <div className="font-bold text-[14px] leading-tight text-[var(--ink)] truncate">
                      {req.subjects?.name}
                    </div>
                    
                    <div className="font-medium text-[12px] text-[var(--ink-soft)] mt-0.5 truncate">
                      {req.type === 'note' 
                        ? `Unit ${req.unit_number}${unitName ? `: ${unitName}` : ''}` 
                        : `Previous Year Paper`}
                    </div>
                  </div>
                  
                  <Link 
                    href={`/admin/upload?subject=${req.subject_id}`}
                    className="bg-[var(--ink)] text-[var(--paper)] p-2.5 rounded-lg flex items-center justify-center shrink-0 hover:opacity-90 active:scale-95 transition-all"
                  >
                    <UploadCloudIcon className="w-5 h-5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UploadCloudIcon, FileTextIcon, ListTodoIcon, HelpCircleIcon, Loader2Icon, TrendingUpIcon } from "lucide-react";

export default function CommunityAdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [uploadsCount, setUploadsCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/community/login');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!prof || prof.status === 'pending') {
        router.push('/community/pending');
        return;
      }
      if (prof.status === 'suspended') {
        router.push('/community/login');
        return;
      }

      setProfile(prof);

      // Fetch uploads count
      const { count: uCount } = await supabase
        .from('content_items')
        .select('*', { count: 'exact', head: true })
        .eq('uploaded_by', user.id);
      setUploadsCount(uCount || 0);

      // Fetch open requests count
      const { count: rCount } = await supabase
        .from('content_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      setRequestsCount(rCount || 0);

      // Fetch recent uploads
      const { data: recents } = await supabase
        .from('content_items')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      setRecentUploads(recents || []);

      setLoading(false);
    }
    checkAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
        <p className="text-[14px] font-semibold text-[var(--ink-soft)]">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col bg-[var(--paper)] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-[19px]">Community Hub</h1>
          <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">Welcome back, Contributor</p>
        </div>
        <span className="bg-[var(--ink)] text-[var(--paper)] font-mono text-[10px] px-2 py-1 rounded font-bold">
          COMMUNITY ADMIN
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border-[1.5px] border-[var(--ink)] rounded-xl p-4 bg-[var(--hl)] text-[var(--ink)] flex flex-col items-center justify-center">
          <div className="font-display font-black text-[32px] leading-none mb-1">{uploadsCount}</div>
          <div className="text-[11px] font-semibold flex items-center gap-1.5 uppercase">
            <UploadCloudIcon className="w-3.5 h-3.5" /> Your Uploads
          </div>
        </div>
        <div className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col items-center justify-center">
          <div className="font-display font-black text-[32px] leading-none mb-1 text-[var(--ink)]">{requestsCount}</div>
          <div className="text-[11px] font-semibold text-[var(--ink-soft)] flex items-center gap-1.5 uppercase">
            <ListTodoIcon className="w-3.5 h-3.5" /> Requests
          </div>
        </div>
      </div>

      <h2 className="font-bold text-[16px] mb-3">Your Actions</h2>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link href="/admin/upload" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center">
              <UploadCloudIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[14px]">Upload Notes</div>
              <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Publish new materials</div>
            </div>
          </Link>
          <Link href="/community/requests" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex flex-col gap-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-[var(--red-bg)] text-[var(--red)] flex items-center justify-center">
              <TrendingUpIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[14px]">Student Requests</div>
              <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">See what's needed most</div>
            </div>
          </Link>
        </div>

      <h2 className="font-bold text-[16px] mb-3">Your Recent Uploads</h2>
      <div className="flex flex-col gap-2.5">
        {recentUploads.length === 0 ? (
          <div className="text-center text-[var(--ink-soft)] py-6 text-[13px] border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg">
            You haven't uploaded anything yet.
          </div>
        ) : (
          recentUploads.map((item) => (
            <div key={item.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] truncate">{item.title.replace(/^null\s/, '')}</div>
                <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5">
                  {item.file_size_kb ? `${(item.file_size_kb / 1024).toFixed(1)} MB` : 'PDF'} · {item.download_count || 0} Downloads
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.status === 'published' ? 'bg-[var(--hl)] text-[var(--ink)]' : 'bg-[var(--paper-deep)] text-[var(--ink-soft)]'}`}>
                {item.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

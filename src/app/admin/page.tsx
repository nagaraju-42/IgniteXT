'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UploadCloudIcon, UsersIcon, FileTextIcon, HelpCircleIcon, Loader2Icon, CheckCircleIcon, XCircleIcon, SettingsIcon, MegaphoneIcon, TicketIcon } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [pendingAdmins, setPendingAdmins] = useState<any[]>([]);
  const [pendingContent, setPendingContent] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [contentCount, setContentCount] = useState(0);

  useEffect(() => {
    async function checkAuthAndLoad() {
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
      
      if (!prof || prof.role !== 'superadmin') {
        router.push('/community');
        return;
      }

      // Fetch pending community admins
      const { data: pAdmins } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'pending');
        
      // Fetch pending content items
      const { data: pContent } = await supabase
        .from('content_items')
        .select('*, profiles(full_name, email), subjects(name)')
        .eq('status', 'draft');

      const { count: sCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      const { count: cCount } = await supabase
        .from('content_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      setPendingAdmins(pAdmins || []);
      setPendingContent(pContent || []);
      setStudentCount(sCount || 0);
      setContentCount(cCount || 0);
      setLoading(false);
    }
    checkAuthAndLoad();
  }, [router, supabase]);

  const approveAdmin = async (id: string) => {
    await supabase.from('profiles').update({ status: 'active' }).eq('id', id);
    setPendingAdmins(prev => prev.filter(a => a.id !== id));
  };

  const approveContent = async (id: string) => {
    await supabase.from('content_items').update({ status: 'published' }).eq('id', id);
    setPendingContent(prev => prev.filter(c => c.id !== id));
  };

  const rejectContent = async (id: string) => {
    await supabase.from('content_items').update({ status: 'flagged' }).eq('id', id);
    setPendingContent(prev => prev.filter(c => c.id !== id));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
        <p className="text-[14px] font-semibold text-[var(--ink-soft)]">Verifying superadmin...</p>
      </div>
    );
  }

  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col min-h-screen bg-[var(--paper)]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-[19px]">Admin Dashboard</h1>
        <span className="bg-[var(--ink)] text-[var(--hl)] font-mono text-[10px] px-2 py-1 rounded font-bold">
          SUPERADMIN
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border-[1.5px] border-[var(--ink)] rounded-xl p-4 bg-[var(--paper-deep)] flex flex-col items-center justify-center">
          <div className="font-display font-black text-[32px] leading-none mb-1">{studentCount.toLocaleString()}</div>
          <div className="text-[11px] font-semibold text-[var(--ink-soft)] flex items-center gap-1.5 uppercase">
            <UsersIcon className="w-3.5 h-3.5" /> Students
          </div>
        </div>
        <div className="border-[1.5px] border-[var(--ink)] rounded-xl p-4 bg-[var(--hl)] text-[var(--hl-ink)] flex flex-col items-center justify-center">
          <div className="font-display font-black text-[32px] leading-none mb-1 text-[var(--ink)]">{contentCount.toLocaleString()}</div>
          <div className="text-[11px] font-semibold text-[var(--ink)] flex items-center gap-1.5 uppercase">
            <FileTextIcon className="w-3.5 h-3.5" /> PDFs Live
          </div>
        </div>
      </div>

      {pendingAdmins.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-[16px] mb-3 text-[var(--red)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--red)] animate-pulse"></span> Pending Contributors
          </h2>
          <div className="flex flex-col gap-2.5">
            {pendingAdmins.map((admin) => (
              <div key={admin.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper-card)] flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] truncate">{admin.full_name}</div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5 truncate">
                    {admin.email} · {admin.college}
                  </div>
                </div>
                <button 
                  onClick={() => approveAdmin(admin.id)}
                  className="bg-[var(--ink)] text-[var(--paper)] p-2 rounded flex items-center gap-1 text-[11px] font-bold shrink-0"
                >
                  <CheckCircleIcon className="w-3.5 h-3.5" /> Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingContent.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-[16px] mb-3 text-[var(--red)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--red)] animate-pulse"></span> Pending Uploads
          </h2>
          <div className="flex flex-col gap-2.5">
            {pendingContent.map((content) => (
              <div key={content.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper-card)] flex flex-col gap-3">
                <div>
                  <div className="font-semibold text-[13px]">{content.title.replace(/^null\s/, content.subjects?.name ? content.subjects.name + ' ' : '')}</div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5">
                    Uploaded by: {content.profiles?.full_name} ({content.profiles?.email})
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => approveContent(content.id)}
                    className="flex-1 bg-[var(--ink)] text-[var(--paper)] py-2 rounded flex items-center justify-center gap-1 text-[11px] font-bold"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button 
                    onClick={() => rejectContent(content.id)}
                    className="flex-1 bg-[var(--red-bg)] text-[var(--red)] py-2 rounded flex items-center justify-center gap-1 text-[11px] font-bold"
                  >
                    <XCircleIcon className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-bold text-[16px] mb-3">Dashboard Controls</h2>
      <div className="flex flex-col gap-3">
        
        <Link href="/admin/live" className="border-[1.5px] border-green-500 rounded-xl p-4 bg-green-500/5 hover:bg-green-500/10 transition-colors flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <div>
            <div className="font-semibold text-[14px] text-green-700">Activity Radar</div>
            <div className="text-[11px] text-green-600/80 mt-0.5">Watch live students & session history</div>
          </div>
        </Link>
        
        <Link href="/admin/upload" className="border-[1.5px] border-[var(--ink)] rounded-xl p-4 bg-[var(--paper-card)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-[var(--paper)] flex items-center justify-center shrink-0">
            <UploadCloudIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Upload Material</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Add new Unit Notes or PYQs</div>
          </div>
        </Link>
        
        <Link href="/admin/taxonomy" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
            <HelpCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Manage Subjects</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Add or edit courses and units</div>
          </div>
        </Link>

        <Link href="/admin/content" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
            <FileTextIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Content & Logs</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Delete PDFs and view activity logs</div>
          </div>
        </Link>

        <Link href="/admin/tickets" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
            <TicketIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Support CRM</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Manage student tickets and feedback</div>
          </div>
        </Link>

        <Link href="/admin/contributors" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Contributors</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Manage community admins and roles</div>
          </div>
        </Link>

        <Link href="/admin/announcements" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
            <MegaphoneIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Announcements</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Target push notifications to students</div>
          </div>
        </Link>

        <Link href="/admin/settings" className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper)] hover:bg-[var(--paper-deep)] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] text-[var(--ink-soft)] flex items-center justify-center shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Platform Settings</div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Monetization, maintenance mode, versions</div>
          </div>
        </Link>

      </div>
    </div>
  );
}

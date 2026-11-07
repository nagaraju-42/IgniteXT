'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, Loader2Icon, SendIcon, ClockIcon, AlertCircleIcon, BellIcon } from "lucide-react";

export default function AnnouncementsManager() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string>('');
  
  const [branches, setBranches] = useState<any[]>([]);
  const [regulations, setRegulations] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') return router.push('/community');
      setUserId(user.id);

      const [bRes, rRes, aRes] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('regulations').select('*'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      setBranches(bRes.data || []);
      setRegulations(rRes.data || []);
      setAnnouncements(aRes.data || []);
      
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setMessage({ text: '', type: '' });

    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title'),
      body: formData.get('body'),
      priority: formData.get('priority'),
      target_branch: formData.get('target_branch') || null,
      target_regulation: formData.get('target_regulation') || null,
      send_notification: formData.get('send_notification') === 'on',
      posted_by: userId
    };

    const { data, error } = await supabase.from('announcements').insert(payload).select().single();
    
    setSending(false);
    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ text: 'Announcement sent successfully!', type: 'success' });
      setAnnouncements([data, ...announcements]);
      e.currentTarget.reset();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-100';
      case 'info': return 'text-blue-500 bg-blue-100';
      default: return 'text-[var(--ink)] bg-[var(--paper-deep)]';
    }
  };

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
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Announcements</div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-6">
        
        {message.text && (
          <div className={`p-3 rounded-lg text-[13px] font-medium mb-6 ${message.type === 'error' ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--hl)] text-[var(--ink)]'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSend} className="flex flex-col gap-4 border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)] mb-8 shadow-sm">
          <h2 className="font-bold text-[16px] flex items-center gap-2">
            <SendIcon className="w-4 h-4" /> Compose Message
          </h2>
          
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Title</label>
            <input required name="title" type="text" placeholder="e.g. Server Maintenance Tonight" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Message Body</label>
            <textarea required name="body" rows={3} placeholder="Write your announcement here..." className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none resize-none"></textarea>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Priority</label>
              <select name="priority" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none appearance-none">
                <option value="normal">Normal</option>
                <option value="info">Info</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Push Notification</label>
              <div className="h-[38px] flex items-center gap-2 bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2">
                <input type="checkbox" name="send_notification" defaultChecked className="w-4 h-4 accent-[var(--ink)]" />
                <span className="text-[12px] font-medium flex items-center gap-1"><BellIcon className="w-3.5 h-3.5"/> Alert Users</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-[var(--rule-strong)] pt-4 mt-2">
            <p className="text-[12px] font-semibold mb-3">Targeting (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Specific Branch</label>
                <select name="target_branch" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-2.5 py-2 text-[12px] font-medium outline-none appearance-none">
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Specific Regulation</label>
                <select name="target_regulation" className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-2.5 py-2 text-[12px] font-medium outline-none appearance-none">
                  <option value="">All Regulations</option>
                  {regulations.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-[var(--ink-soft)] mt-2">Leave blank to broadcast to all students.</p>
          </div>

          <button type="submit" disabled={sending} className="btn btn-p flex items-center justify-center gap-2 py-3 mt-2">
            {sending ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <SendIcon className="w-4 h-4" />}
            {sending ? 'Sending...' : 'Publish Announcement'}
          </button>
        </form>

        <h2 className="font-bold text-[16px] mb-4 flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-[var(--ink-soft)]" /> Announcement History
        </h2>
        
        {announcements.length === 0 ? (
          <div className="text-center text-[var(--ink-soft)] py-6 text-[13px]">
            No announcements sent yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map(ann => (
              <div key={ann.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col gap-2 relative overflow-hidden">
                {!ann.is_active && <div className="absolute top-0 right-0 bg-[var(--paper-deep)] text-[var(--ink-soft)] text-[9px] font-bold px-2 py-1 uppercase rounded-bl">Archived</div>}
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-[14px] pr-8">{ann.title}</h3>
                </div>
                <p className="text-[12px] text-[var(--ink)] leading-relaxed">{ann.body}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-3 border-t border-[var(--rule)]">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${getPriorityColor(ann.priority)}`}>
                    {ann.priority}
                  </span>
                  {(ann.target_branch || ann.target_regulation) && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-[var(--paper-deep)] text-[var(--ink)]">
                      Target: {ann.target_branch || 'ALL'} {ann.target_regulation || 'ALL'}
                    </span>
                  )}
                  {ann.send_notification && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-[var(--hl)] text-[var(--ink)] flex items-center gap-1">
                      <BellIcon className="w-2.5 h-2.5" /> Pushed
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--ink-soft)] ml-auto font-mono">
                    {new Date(ann.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

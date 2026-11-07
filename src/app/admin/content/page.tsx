'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, Loader2Icon, Trash2Icon, FileTextIcon, ActivityIcon, SearchIcon, FlagIcon } from "lucide-react";

export default function ContentAndLogs() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'logs' | 'reported'>('content');
  const [userId, setUserId] = useState('');
  
  const [contents, setContents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') return router.push('/community');
      
      setUserId(user.id);

      const [cRes, lRes, rRes] = await Promise.all([
        supabase.from('content_with_meta').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('admin_activity_log').select('*, profiles(full_name, role)').order('created_at', { ascending: false }).limit(50),
        supabase.from('moderation_flags').select('*, content_items(title, file_url, subject_id)').eq('status', 'pending').order('created_at', { ascending: false })
      ]);

      if (cRes.data) setContents(cRes.data);
      if (lRes.data) setLogs(lRes.data);
      if (rRes.data) setReports(rRes.data);

      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  const handleDismissReport = async (reportId: string) => {
    await supabase.from('moderation_flags').update({ status: 'resolved' }).eq('id', reportId);
    setReports(reports.filter(r => r.id !== reportId));
  };

  const handleDeleteContent = async (item: any) => {
    const confirm = window.confirm(`Are you sure you want to delete "${item.title}"? This cannot be undone.`);
    if (!confirm) return;

    // Delete content item
    const { error } = await supabase.from('content_items').delete().eq('id', item.id);
    if (error) {
      alert(`Error deleting content: ${error.message}`);
      return;
    }

    // Log the deletion
    await supabase.from('admin_activity_log').insert({
      admin_id: userId,
      action: 'DELETE_CONTENT',
      target_type: 'content_items',
      target_id: item.id,
      meta: { title: item.title, subject_code: item.subject_code, deleted_by: 'Superadmin' }
    });

    setContents(contents.filter(c => c.id !== item.id));
    
    // Refresh logs
    const lRes = await supabase.from('admin_activity_log').select('*, profiles(full_name, role)').order('created_at', { ascending: false }).limit(50);
    if (lRes.data) setLogs(lRes.data);
  };

  const filteredContents = contents.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.subject_code && c.subject_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Content & Logs</div>
      </div>

      <div className="flex border-b border-[var(--rule-strong)]">
        <button 
          onClick={() => setActiveTab('content')}
          className={`flex-1 flex justify-center items-center gap-2 py-3 text-[13px] font-bold transition-colors ${activeTab === 'content' ? 'border-b-2 border-[var(--ink)] text-[var(--ink)] bg-[var(--paper-deep)]' : 'text-[var(--ink-soft)]'}`}
        >
          <FileTextIcon className="w-4 h-4" /> Manage PDFs
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`flex-1 flex justify-center items-center gap-2 py-3 text-[13px] font-bold transition-colors ${activeTab === 'logs' ? 'border-b-2 border-[var(--ink)] text-[var(--ink)] bg-[var(--paper-deep)]' : 'text-[var(--ink-soft)]'}`}
        >
          <ActivityIcon className="w-4 h-4" /> Activity Logs
        </button>
        <button 
          onClick={() => setActiveTab('reported')}
          className={`flex-1 flex justify-center items-center gap-2 py-3 text-[13px] font-bold transition-colors ${activeTab === 'reported' ? 'border-b-2 border-[var(--red)] text-[var(--red)] bg-[var(--red-bg)]' : 'text-[var(--ink-soft)]'}`}
        >
          <FlagIcon className="w-4 h-4" /> Reported
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-[18px]">
        {activeTab === 'content' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 mb-2">
              <SearchIcon className="w-4 h-4 text-[var(--ink-soft)]" />
              <input 
                type="text" 
                placeholder="Search PDFs by title or code..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[13px] outline-none"
              />
            </div>

            {filteredContents.length === 0 ? (
              <div className="text-center text-[var(--ink-soft)] py-10 text-[13px]">
                No content found.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredContents.map(item => (
                  <div key={item.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="font-bold text-[14px] leading-tight line-clamp-2 pr-4 text-[var(--ink)]">
                        {item.title.replace(/^null\s/, item.subject_name ? item.subject_name + ' ' : '')}
                      </div>
                      <button 
                        onClick={() => handleDeleteContent(item)}
                        className="text-[var(--red)] font-semibold p-2 -mr-2 -mt-2 rounded hover:bg-[var(--red-bg)] transition-colors shrink-0"
                        title="Delete Content"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="bg-[var(--paper-deep)] text-[var(--ink-soft)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {item.subject_name} {item.subject_code && `(${item.subject_code})`}
                      </span>
                      {item.unit_title && (
                        <span className="bg-[var(--hl)] text-[var(--ink)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          {item.unit_title}
                        </span>
                      )}
                    </div>

                    <div className="font-mono text-[10px] text-[var(--ink-soft)] flex items-center justify-between mt-2 pt-2 border-t border-[var(--rule)]">
                      <span>{item.download_count} DLs</span>
                      <span>By: {item.uploader_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col gap-3">
            {logs.length === 0 ? (
              <div className="text-center text-[var(--ink-soft)] py-10 text-[13px]">
                No activity logs found.
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${log.action === 'DELETE_CONTENT' ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--hl)] text-[var(--ink)]'}`}>
                      {log.action.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="text-[13px] font-medium leading-relaxed mt-1">
                    <span className="font-bold">{log.profiles?.full_name || 'An admin'}</span> 
                    {log.action === 'DELETE_CONTENT' ? ' deleted ' : ' uploaded '}
                    <span className="italic">"{log.meta?.title || 'a PDF'}"</span>
                  </div>
                  
                  {log.meta?.subject_code && (
                    <div className="text-[11px] text-[var(--ink-soft)] font-mono">
                      Subject: {log.meta.subject_code}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reported' && (
          <div className="flex flex-col gap-3">
            {reports.length === 0 ? (
              <div className="text-center text-[var(--ink-soft)] py-10 text-[13px]">
                No pending reports. All good!
              </div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="bg-[var(--red-bg)] text-[var(--red)] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        Reported
                      </span>
                      <div className="font-bold text-[14px] mt-1.5">{report.content_items?.title || 'Unknown Title'}</div>
                    </div>
                  </div>
                  
                  <div className="bg-[var(--paper-deep)] p-3 rounded-lg border border-[var(--rule)]">
                    <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-0.5">Reason</div>
                    <div className="text-[13px] font-medium text-[var(--ink)]">{report.reason}</div>
                  </div>
                  
                  <div className="flex gap-2 mt-1">
                    <button 
                      onClick={async () => {
                        await handleDeleteContent({ id: report.content_id, title: report.content_items?.title });
                        handleDismissReport(report.id);
                      }}
                      className="flex-1 bg-[var(--red-bg)] text-[var(--red)] font-bold text-[12px] py-2 rounded-lg hover:bg-[var(--red)] hover:text-white transition-colors"
                    >
                      Delete PDF
                    </button>
                    <button 
                      onClick={() => handleDismissReport(report.id)}
                      className="flex-1 bg-[var(--paper-deep)] text-[var(--ink)] font-bold text-[12px] py-2 rounded-lg hover:bg-[var(--rule-strong)] transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

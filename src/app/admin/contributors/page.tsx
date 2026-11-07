'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, Loader2Icon, ShieldBanIcon, CheckCircleIcon, UserIcon } from "lucide-react";

export default function ContributorManagement() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [contributors, setContributors] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') return router.push('/community');

      const { data } = await supabase
        .from('profiles')
        .select(`
          *,
          content_items(id)
        `)
        .eq('role', 'community_admin')
        .order('created_at', { ascending: false });

      if (data) {
        setContributors(data);
      }
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setContributors(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
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
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Contributors</div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-6">
        
        {contributors.length === 0 ? (
          <div className="text-center text-[var(--ink-soft)] py-10 text-[13px]">
            No community admins found yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {contributors.map(admin => (
              <div key={admin.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 bg-[var(--paper-card)] flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-[var(--ink-soft)]" />
                      {admin.full_name || 'Unnamed Admin'}
                    </div>
                    <div className="text-[12px] text-[var(--ink-soft)] font-mono mt-1 truncate">
                      {admin.email}
                    </div>
                    {admin.college && (
                      <div className="text-[11px] font-semibold mt-1">
                        {admin.college} {admin.department ? `· ${admin.department}` : ''}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      admin.status === 'active' ? 'bg-[var(--hl)] text-[var(--ink)]' : 
                      admin.status === 'suspended' ? 'bg-[var(--red-bg)] text-[var(--red)]' : 
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {admin.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--rule)]">
                  <div className="text-[12px] font-semibold">
                    <span className="text-[var(--ink-soft)] uppercase text-[10px] block mb-0.5">Total Uploads</span>
                    {admin.content_items?.length || 0} Materials
                  </div>
                  
                  {admin.status !== 'pending' && (
                    <button 
                      onClick={() => toggleStatus(admin.id, admin.status)}
                      className={`btn !py-1.5 !px-3 !text-[11px] flex items-center gap-1.5 ${
                        admin.status === 'active' ? 'bg-[var(--paper-deep)] text-[var(--ink)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]' : 'btn-p'
                      }`}
                    >
                      {admin.status === 'active' ? (
                        <><ShieldBanIcon className="w-3.5 h-3.5" /> Suspend Account</>
                      ) : (
                        <><CheckCircleIcon className="w-3.5 h-3.5" /> Reactivate Account</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

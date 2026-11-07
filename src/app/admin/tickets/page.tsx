'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, Loader2Icon, BugIcon, LightbulbIcon, FileQuestionIcon, MessageSquareIcon, TicketIcon, SearchIcon } from "lucide-react";

export default function SupportTickets() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function loadTickets() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      // Verify superadmin
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') return router.push('/community');

      // Fetch tickets with user info (if they were logged in)
      const { data } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profiles (full_name, email, role)
        `)
        .order('created_at', { ascending: false });

      if (data) setTickets(data);
      setLoading(false);
    }
    loadTickets();
  }, [router, supabase]);

  const updateTicketStatus = async (id: string, newStatus: string) => {
    // Optimistic UI update
    setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
    
    // DB update
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert("Error updating status: " + error.message);
      // Revert optimistic update
      const { data } = await supabase.from('support_tickets').select('*, profiles(full_name, email, role)').order('created_at', { ascending: false });
      if (data) setTickets(data);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
      </div>
    );
  }

  const filteredTickets = tickets.filter(t => filter === 'all' || t.status === filter);

  // Group tickets into columns if 'all' is selected to form a mini kanban
  const openTickets = tickets.filter(t => t.status === 'open');
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug': return <BugIcon className="w-4 h-4 text-red-500" />;
      case 'feature': return <LightbulbIcon className="w-4 h-4 text-yellow-500" />;
      case 'content': return <FileQuestionIcon className="w-4 h-4 text-blue-500" />;
      default: return <MessageSquareIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderTicketCard = (ticket: any) => (
    <div key={ticket.id} className="bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getCategoryIcon(ticket.category)}
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
            {ticket.category}
          </span>
        </div>
        <span className="text-[10px] text-[var(--ink-faint)] font-mono">
          {new Date(ticket.created_at).toLocaleDateString()}
        </span>
      </div>

      <p className="text-[13px] text-[var(--ink)] leading-snug font-medium break-words whitespace-pre-wrap bg-[var(--paper-deep)] p-3 rounded-lg border border-[var(--rule)]">
        {ticket.message}
      </p>

      {ticket.profiles && (
        <div className="text-[11px] text-[var(--ink-soft)] font-medium flex flex-col">
          <span>From: {ticket.profiles.full_name}</span>
          <span className="font-mono text-[10px]">{ticket.profiles.email}</span>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        {ticket.status !== 'open' && (
          <button 
            onClick={() => updateTicketStatus(ticket.id, 'open')}
            className="flex-1 bg-[var(--paper-deep)] text-[var(--ink-soft)] font-bold text-[11px] py-1.5 rounded-lg hover:bg-[var(--rule)] transition-colors"
          >
            Mark Open
          </button>
        )}
        {ticket.status !== 'in_progress' && (
          <button 
            onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
            className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[11px] py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
          >
            In Progress
          </button>
        )}
        {ticket.status !== 'resolved' && (
          <button 
            onClick={() => updateTicketStatus(ticket.id, 'resolved')}
            className="flex-1 bg-green-50 border border-green-200 text-green-700 font-bold text-[11px] py-1.5 rounded-lg hover:bg-green-100 transition-colors"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--paper-deep)] min-h-screen">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center shadow-sm sticky top-0 z-10 shrink-0">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] flex-1 text-center pr-6 flex items-center justify-center gap-2">
          <TicketIcon className="w-4 h-4" /> Support CRM
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--rule-strong)] bg-[var(--paper)] shrink-0 overflow-x-auto">
        {['all', 'open', 'in_progress', 'resolved'].map(status => (
          <button 
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-3 text-[12px] font-bold transition-colors whitespace-nowrap ${filter === status ? 'border-b-2 border-[var(--ink)] text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}
          >
            {status.replace('_', ' ').toUpperCase()} 
            ({tickets.filter(t => status === 'all' || t.status === status).length})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-[18px]">
        
        {/* Kanban Board Layout when 'all' is selected */}
        {filter === 'all' ? (
          <div className="flex gap-4 min-w-[800px] h-full pb-8">
            
            <div className="flex-1 min-w-[280px] flex flex-col gap-3">
              <h2 className="font-bold text-[13px] text-[var(--ink)] uppercase tracking-wider flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                Open ({openTickets.length})
              </h2>
              {openTickets.map(renderTicketCard)}
              {openTickets.length === 0 && <div className="text-[12px] text-[var(--ink-faint)] italic p-4 text-center border border-dashed border-[var(--rule-strong)] rounded-xl">No open tickets</div>}
            </div>

            <div className="flex-1 min-w-[280px] flex flex-col gap-3">
              <h2 className="font-bold text-[13px] text-[var(--ink)] uppercase tracking-wider flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                In Progress ({inProgressTickets.length})
              </h2>
              {inProgressTickets.map(renderTicketCard)}
              {inProgressTickets.length === 0 && <div className="text-[12px] text-[var(--ink-faint)] italic p-4 text-center border border-dashed border-[var(--rule-strong)] rounded-xl">No tickets in progress</div>}
            </div>

            <div className="flex-1 min-w-[280px] flex flex-col gap-3">
              <h2 className="font-bold text-[13px] text-[var(--ink)] uppercase tracking-wider flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                Resolved ({resolvedTickets.length})
              </h2>
              {resolvedTickets.map(renderTicketCard)}
              {resolvedTickets.length === 0 && <div className="text-[12px] text-[var(--ink-faint)] italic p-4 text-center border border-dashed border-[var(--rule-strong)] rounded-xl">No resolved tickets</div>}
            </div>

          </div>
        ) : (
          /* List layout for filtered tabs */
          <div className="flex flex-col gap-3 max-w-xl mx-auto pb-8">
            {filteredTickets.map(renderTicketCard)}
            {filteredTickets.length === 0 && <div className="text-center p-8 text-[var(--ink-soft)] text-[13px]">No tickets found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

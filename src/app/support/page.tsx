'use client';

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, Loader2Icon, CheckCircle2Icon, MessageSquareIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SupportPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    
    // Attempt to attach user_id if they are logged in (community admins)
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('support_tickets').insert({
      user_id: user?.id || null,
      category,
      message: message.trim()
    });

    setLoading(false);
    
    if (error) {
      alert("Failed to submit ticket: " + error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] min-h-screen">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </button>
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Help & Feedback</div>
      </div>

      <div className="flex-1 overflow-y-auto p-[18px] flex flex-col items-center">
        <div className="w-full max-w-md">
          
          <div className="bg-[var(--paper-deep)] rounded-xl p-5 mb-6 flex gap-4 items-start border border-[var(--rule)]">
            <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-[var(--paper)] flex items-center justify-center shrink-0">
              <MessageSquareIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-[var(--ink)]">How can we help?</h2>
              <p className="text-[13px] text-[var(--ink-soft)] leading-snug mt-1">
                Found a bug? Have a feature request? Let us know and our team will look into it right away.
              </p>
            </div>
          </div>

          {success ? (
            <div className="border-[1.5px] border-green-200 bg-green-50 rounded-xl p-8 text-center flex flex-col items-center">
              <CheckCircle2Icon className="w-12 h-12 text-green-500 mb-3" />
              <h3 className="font-bold text-[18px] text-green-900">Ticket Submitted</h3>
              <p className="text-[13px] text-green-700 mt-2 mb-6">
                Thank you for your feedback! We review every message to make the app better.
              </p>
              <button 
                onClick={() => router.push('/')}
                className="bg-green-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm hover:bg-green-700 active:scale-95 transition-all"
              >
                Return to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[var(--ink)]">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'bug', label: 'Bug Report' },
                    { id: 'feature', label: 'Feature Request' },
                    { id: 'content', label: 'Missing Content' },
                    { id: 'general', label: 'General Feedback' }
                  ].map(cat => (
                    <label 
                      key={cat.id} 
                      className={`
                        border-[1.5px] rounded-lg p-3 text-center cursor-pointer font-semibold text-[13px] transition-colors
                        ${category === cat.id ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-md' : 'border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]'}
                      `}
                    >
                      <input 
                        type="radio" 
                        name="category" 
                        value={cat.id} 
                        checked={category === cat.id} 
                        onChange={(e) => setCategory(e.target.value)} 
                        className="hidden" 
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[var(--ink)]">Message</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your issue or suggestion in detail..."
                  className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-xl p-4 text-[14px] min-h-[150px] resize-none focus:outline-none focus:border-[var(--ink)]"
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || !message.trim()}
                className="w-full bg-[var(--ink)] text-[var(--paper)] font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : 'Submit Ticket'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

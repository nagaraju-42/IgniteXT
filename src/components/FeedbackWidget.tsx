'use client';

import { useState } from 'react';
import { MessageSquareIcon, XIcon, SendIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setLoading(true);

    try {
      let roll = '';
      let spaceInfo = '';
      try {
        const saved = localStorage.getItem('semkit_user_profile') || localStorage.getItem('ignitext_user_profile') || localStorage.getItem('semkit_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          roll = parsed.roll || '';
          spaceInfo = `${parsed.reg_code || ''} ${parsed.branch_code || ''} Sem ${parsed.sem || ''}`.trim();
        }
      } catch (err) {}

      let validUserId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
          if (prof) validUserId = user.id;
        }
      } catch (e) {}

      const contactString = [roll, spaceInfo].filter(Boolean).join(' · ') || 'Anonymous Student';

      const { error: ticketErr } = await supabase.from('support_tickets').insert({
        user_id: validUserId,
        category: 'general',
        message: `[Floating Feedback] ${feedback.trim()} (User: ${contactString})`,
        status: 'open',
      });

      if (ticketErr) {
        console.warn("Feedback insert error, trying null user_id fallback:", ticketErr);
        await supabase.from('support_tickets').insert({
          user_id: null,
          category: 'general',
          message: `[Floating Feedback] ${feedback.trim()} (User: ${contactString})`,
          status: 'open',
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Error submitting ticket:", err);
    }

    setLoading(false);
    setSubmitted(true);
    setTimeout(() => {
      setIsOpen(false);
      setSubmitted(false);
      setFeedback('');
    }, 2000);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        data-hide-on-pdf-fullscreen="true" className="absolute bottom-[80px] right-4 w-[46px] h-[46px] rounded-full bg-[var(--ink)] shadow-[4px_4px_0_rgba(0,0,0,0.2)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 border-[2px] border-[var(--paper)]"
      >
        <MessageSquareIcon className="w-5 h-5 text-[var(--paper)]" />
      </button>

      {isOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--paper)] border-[3px] border-[var(--ink)] w-full max-w-[340px] rounded-[24px] shadow-[8px_8px_0_var(--ink)] overflow-hidden relative">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-[var(--ink-soft)] hover:text-[var(--ink)]">
              <XIcon className="w-5 h-5" />
            </button>

            <div className="p-6 pt-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--hl-bg)] flex items-center justify-center border-[2px] border-[var(--ink)]">
                  <MessageSquareIcon className="w-4 h-4 text-[var(--ink)]" />
                </div>
                <h2 className="font-bold text-[18px]">App Feedback</h2>
              </div>
              
              {submitted ? (
                <div className="py-8 flex flex-col items-center text-center animate-in zoom-in duration-300">
                  <div className="w-12 h-12 rounded-full bg-[var(--hl)] flex items-center justify-center mb-3">
                    <SendIcon className="w-6 h-6 text-[var(--ink)]" />
                  </div>
                  <h3 className="font-bold text-[16px] mb-1">Feedback Sent!</h3>
                  <p className="text-[13px] text-[var(--ink-soft)]">Thank you for helping us improve SemKit.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <p className="text-[13px] text-[var(--ink-soft)] leading-snug mb-1">
                    Found a bug? Have a feature request? Let us know what you think!
                  </p>
                  
                  <textarea 
                    autoFocus
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us everything..."
                    className="w-full bg-[var(--paper-deep)] border-[2px] border-[var(--rule-strong)] rounded-xl p-3 text-[14px] min-h-[120px] resize-none focus:outline-none focus:border-[var(--ink)] transition-colors"
                  />
                  
                  <button 
                    type="submit"
                    disabled={!feedback.trim()}
                    className="w-full bg-[var(--ink)] text-[var(--paper)] border-[2px] border-[var(--ink)] rounded-xl py-3 font-bold text-[14px] shadow-[3px_3px_0_rgba(0,0,0,0.2)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:active:translate-y-0 disabled:active:translate-x-0 disabled:active:shadow-[3px_3px_0_rgba(0,0,0,0.2)]"
                  >
                    Send Feedback
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useState } from "react";
import { FlagIcon, XIcon, Loader2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ReportButtonProps {
  contentId: string;
}

export function ReportButton({ contentId }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    
    setLoading(true);
    
    // Attempt to get user if logged in, but reporting works anonymously too
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('moderation_flags').insert({
      content_id: contentId,
      reporter_id: user?.id || null,
      reason: reason
    });

    setLoading(false);
    setSuccess(true);
    setTimeout(() => {
      setIsOpen(false);
      setSuccess(false);
      setReason("");
    }, 2000);
  };

  return (
    <>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className="w-8 h-8 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--red)] transition-colors rounded-lg shrink-0"
        title="Report Issue"
      >
        <FlagIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[var(--paper)] rounded-xl w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-[var(--rule)]">
              <h3 className="font-bold text-[16px] text-[var(--ink)] flex items-center gap-2">
                <FlagIcon className="w-4 h-4 text-[var(--red)]" /> Report Content
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              {success ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="font-bold text-[14px]">Report Submitted</p>
                  <p className="text-[12px] text-[var(--ink-soft)] mt-1">Our moderation team will review this shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleReport} className="flex flex-col gap-4">
                  <p className="text-[12px] text-[var(--ink-soft)] leading-snug">
                    Please let us know what's wrong with this PDF. False reports may lead to account suspension.
                  </p>
                  
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 p-2.5 border-[1.5px] border-[var(--rule-strong)] rounded-lg cursor-pointer hover:bg-[var(--paper-deep)]">
                      <input type="radio" name="reason" value="Blurry or Unreadable" onChange={(e) => setReason(e.target.value)} className="accent-[var(--red)]" required />
                      <span className="text-[13px] font-medium">Blurry or Unreadable</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 border-[1.5px] border-[var(--rule-strong)] rounded-lg cursor-pointer hover:bg-[var(--paper-deep)]">
                      <input type="radio" name="reason" value="Wrong Subject / Outdated" onChange={(e) => setReason(e.target.value)} className="accent-[var(--red)]" required />
                      <span className="text-[13px] font-medium">Wrong Subject / Outdated</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 border-[1.5px] border-[var(--rule-strong)] rounded-lg cursor-pointer hover:bg-[var(--paper-deep)]">
                      <input type="radio" name="reason" value="Spam / Inappropriate" onChange={(e) => setReason(e.target.value)} className="accent-[var(--red)]" required />
                      <span className="text-[13px] font-medium">Spam / Inappropriate</span>
                    </label>
                  </div>

                  <button type="submit" disabled={loading || !reason} className="w-full bg-[var(--red)] text-white font-bold text-[13px] py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-2">
                    {loading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : 'Submit Report'}
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

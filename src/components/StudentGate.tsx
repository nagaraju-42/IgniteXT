'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2Icon, LockIcon, XIcon } from 'lucide-react';

let triggerGateCallback: (() => void) | null = null;
let gateSuccessCallback: (() => void) | null = null;

// Exported function that any component can call to enforce the gate
export const requireStudentAccess = (onSuccess: () => void) => {
  const ht = typeof window !== 'undefined' ? localStorage.getItem('student_ht') : null;
  if (ht) {
    onSuccess();
  } else {
    gateSuccessCallback = onSuccess;
    if (triggerGateCallback) triggerGateCallback();
  }
};

export function StudentGateModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [ht, setHt] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    triggerGateCallback = () => setIsOpen(true);
    return () => { triggerGateCallback = null; };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ht.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.rpc('register_student', { p_hall_ticket: ht.trim() });
      if (error) throw error;
      
      localStorage.setItem('student_ht', ht.trim().toUpperCase());
      setIsOpen(false);
      
      // Execute the pending action (like downloading or reading)
      if (gateSuccessCallback) {
        gateSuccessCallback();
        gateSuccessCallback = null;
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to verify: ' + err.message);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    gateSuccessCallback = null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-[1.5px] border-[var(--rule-strong)]">
        <div className="p-6">
          <div className="w-12 h-12 bg-[var(--paper-deep)] rounded-full flex items-center justify-center mb-4 border border-[var(--rule)]">
            <LockIcon className="w-6 h-6 text-[var(--ink)]" />
          </div>
          
          <h2 className="font-bold text-[20px] text-[var(--ink)] leading-tight mb-1">Student Access</h2>
          <p className="text-[13px] text-[var(--ink-soft)] mb-6">
            Please enter your college hall ticket number to access and download this material.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1.5 block">
                Hall Ticket Number
              </label>
              <input
                type="text"
                placeholder="e.g. 21X41A0501"
                value={ht}
                onChange={(e) => setHt(e.target.value.toUpperCase())}
                className="w-full bg-[var(--paper-card)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-4 py-3 text-[15px] font-mono font-bold focus:outline-none focus:border-[var(--ink)] transition-colors uppercase placeholder:text-[var(--ink-faint)] placeholder:font-sans placeholder:font-normal"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-[var(--paper-deep)] text-[var(--ink)] font-bold text-[14px] py-3 rounded-xl hover:bg-[var(--rule)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !ht.trim()}
                className="flex-[2] bg-[var(--ink)] text-[var(--paper)] font-bold text-[14px] py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

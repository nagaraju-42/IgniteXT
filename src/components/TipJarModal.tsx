'use client';

import { useState, useEffect } from 'react';
import { XIcon, CheckCircle2Icon, ZapIcon, BookmarkCheckIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface TipJarModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
}

export function TipJarModal({ isOpen, onClose, documentTitle }: TipJarModalProps) {
  const [showTipJar, setShowTipJar] = useState(false);
  const [upiId, setUpiId] = useState('nagaraju42@fam');
  const supabase = createClient();

  useEffect(() => {
    // 1. Check cached setting immediately
    try {
      const cached = localStorage.getItem('semkit_show_tip_jar');
      if (cached !== null) {
        setShowTipJar(cached === 'true');
      }
    } catch (e) {}

    // 2. Query platform_settings table in Supabase
    async function loadSettings() {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('key, value')
          .in('key', ['show_tip_jar', 'upi_id']);
        
        if (data && data.length > 0) {
          const tipRow = data.find((r: any) => r.key === 'show_tip_jar');
          const upiRow = data.find((r: any) => r.key === 'upi_id');
          if (tipRow) {
            const isEnabled = tipRow.value === 'true';
            setShowTipJar(isEnabled);
            try { localStorage.setItem('semkit_show_tip_jar', String(isEnabled)); } catch(e) {}
          }
          if (upiRow && upiRow.value) {
            setUpiId(upiRow.value);
          }
        }
      } catch (err) {}
    }

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border-[3px] border-[var(--ink)] w-full max-w-[340px] rounded-[24px] shadow-[8px_8px_0_var(--ink)] overflow-hidden relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[var(--ink-soft)] hover:text-[var(--ink)] p-1 rounded-full hover:bg-[var(--rule)] transition-colors cursor-pointer"
        >
          <XIcon className="w-5 h-5" />
        </button>

        <div className="p-6 pt-7 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#D7E600] flex items-center justify-center mb-3.5 border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]">
            <CheckCircle2Icon className="w-7 h-7 text-[var(--ink)]" />
          </div>
          
          <h2 className="font-bold text-[20px] mb-1.5 font-display uppercase tracking-tight text-[var(--ink)]">
            Download Complete!
          </h2>
          <p className="text-[12.5px] text-[var(--ink-soft)] mb-5 font-medium leading-relaxed px-1">
            Your document <span className="text-[var(--ink)] font-bold">"{documentTitle}"</span> is ready for offline reading.
          </p>

          {/* When Show Tip Jar is ON: Show QR Code & UPI Banner */}
          {showTipJar ? (
            <>
              <div className="bg-[var(--paper-deep)] p-4 rounded-xl border-dashed border-2 border-[var(--rule-strong)] mb-5 text-left w-full">
                <p className="text-[12px] font-medium text-[var(--ink-soft)] mb-3 text-center leading-snug">
                  SemKit is completely free and built by students. If this note helped you study, consider dropping a small tip to keep our servers running!
                </p>
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-[130px] h-[130px] rounded-xl overflow-hidden border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]">
                    <img src="/qr.jpg" alt="UPI QR Code" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] font-bold text-[var(--ink-soft)] tracking-wider uppercase">Scan to Donate</p>
                  
                  <div className="w-full mt-1">
                    <button 
                      onClick={() => window.location.href = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=SemKit&cu=INR`} 
                      className="w-full bg-[var(--paper)] border-[2px] border-[var(--ink)] rounded-lg py-2 flex items-center justify-center gap-1.5 font-bold text-[12px] hover:bg-[var(--paper-card)] shadow-[2px_2px_0_var(--ink)] transition-transform active:translate-y-[1px] active:shadow-none text-[var(--ink)] cursor-pointer"
                    >
                      <ZapIcon className="w-4 h-4 fill-[var(--hl)]" /> Tap to Pay with UPI App
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] underline underline-offset-4 cursor-pointer"
              >
                Maybe later
              </button>
            </>
          ) : (
            /* When Show Tip Jar is OFF: Clean download complete prompt without any donation asking */
            <div className="w-full flex flex-col gap-2.5 mt-1">
              <Link
                href="/saved"
                onClick={onClose}
                className="w-full bg-[var(--ink)] text-[var(--paper)] py-2.5 rounded-xl font-bold text-[13px] shadow-[2px_2px_0_rgba(0,0,0,0.2)] flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all"
              >
                <BookmarkCheckIcon className="w-4 h-4" /> View in Saved Notes
              </Link>
              <button
                onClick={onClose}
                className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] text-[var(--ink)] py-2 rounded-xl font-bold text-[12.5px] hover:bg-[var(--rule)] active:scale-98 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

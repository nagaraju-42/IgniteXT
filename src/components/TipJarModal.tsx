'use client';

import { XIcon, HeartIcon, CoffeeIcon, ZapIcon } from 'lucide-react';

interface TipJarModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
}

export function TipJarModal({ isOpen, onClose, documentTitle }: TipJarModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border-[3px] border-[var(--ink)] w-full max-w-[340px] rounded-[24px] shadow-[8px_8px_0_var(--ink)] overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <XIcon className="w-5 h-5" />
        </button>

        <div className="p-6 pt-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--hl-bg)] flex items-center justify-center mb-4 border-[3px] border-[var(--ink)] shadow-[4px_4px_0_var(--ink)]">
            <HeartIcon className="w-7 h-7 text-[var(--ink)] fill-[var(--hl)]" />
          </div>
          
          <h2 className="font-bold text-[22px] mb-2 font-display uppercase tracking-tight">Download Complete!</h2>
          <p className="text-[14px] text-[var(--ink-soft)] mb-6 font-medium leading-relaxed">
            Your document <span className="text-[var(--ink)] font-bold">"{documentTitle}"</span> is ready for offline reading.
          </p>

          <div className="bg-[var(--paper-deep)] p-4 rounded-xl border-dashed border-2 border-[var(--rule-strong)] mb-6 text-left">
            <p className="text-[13px] font-medium text-[var(--ink-soft)] mb-3 text-center">
              SemKit is completely free and built by students. If this note helped you study for your exams, consider dropping a small tip to keep our servers running!
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="w-[140px] h-[140px] rounded-xl overflow-hidden border-[3px] border-[var(--ink)] shadow-[4px_4px_0_var(--ink)]">
                <img src="/qr.jpg" alt="UPI QR Code" className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] font-bold text-[var(--ink-soft)] tracking-wider uppercase">Scan to Donate</p>
              
              <div className="w-full mt-1">
                <button 
                  onClick={() => window.location.href = 'upi://pay?pa=nagaraju42@fam&pn=SemKit&cu=INR'} 
                  className="w-full bg-[var(--paper)] border-[2px] border-[var(--ink)] rounded-lg py-2 flex items-center justify-center gap-1.5 font-bold text-[13px] hover:bg-[var(--paper-card)] shadow-[2px_2px_0_var(--ink)] transition-transform active:translate-y-[2px] active:translate-x-[2px] active:shadow-none text-[var(--ink)]"
                >
                  <ZapIcon className="w-4 h-4 fill-[var(--hl)]" /> Tap to Pay with UPI App
                </button>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] underline underline-offset-4">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

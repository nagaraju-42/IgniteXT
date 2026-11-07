'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, SendIcon, CheckCircle2Icon, BugIcon, LightbulbIcon, FileQuestionIcon, MessageSquareIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SupportPage() {
  const [category, setCategory] = useState<'bug' | 'feature' | 'content' | 'general'>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      let roll = '';
      try {
        const saved = localStorage.getItem('ignitext_profile');
        if (saved) roll = JSON.parse(saved).roll;
      } catch (err) {}

      await supabase.from('content_requests').insert({
        request_text: `[${category.toUpperCase()}] ${message.trim()} (Contact: ${email || roll || 'Anonymous'})`,
        status: 'open',
      }).catch(() => {});
    } catch (err) {}

    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="px-[18px] pt-4 pb-12 flex flex-col h-full bg-[var(--paper-card)]">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-soft)] mb-4 hover:text-[var(--ink)]"
      >
        <ChevronLeftIcon className="w-4 h-4" /> Back to Home
      </Link>

      <div className="border-[2px] border-[var(--ink)] rounded-2xl p-5 bg-[var(--paper)] shadow-[3px_3px_0_var(--ink)]">
        <h1 className="font-bold text-[20px] text-[var(--ink)] mb-1">Feedback & Support</h1>
        <p className="text-[12.5px] text-[var(--ink-soft)] mb-5">
          Have an issue, bug report, or want to request notes for a specific subject? Let us know below!
        </p>

        {submitted ? (
          <div className="py-8 text-center flex flex-col items-center">
            <CheckCircle2Icon className="w-12 h-12 text-[#10b981] mb-2" />
            <h2 className="font-bold text-[17px] text-[var(--ink)] mb-1">Thank You!</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)] max-w-[240px] mb-6">
              Your feedback has been received. We review community requests regularly.
            </p>
            <Link
              href="/"
              className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[13px] px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              Return to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 block">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'general', label: 'General Feedback', icon: MessageSquareIcon },
                  { id: 'bug', label: 'Report a Bug', icon: BugIcon },
                  { id: 'content', label: 'Request Notes/PYQs', icon: FileQuestionIcon },
                  { id: 'feature', label: 'Feature Idea', icon: LightbulbIcon },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSel = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`p-2.5 rounded-xl border-[1.5px] text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)] shadow-sm'
                          : 'bg-[var(--paper-deep)] text-[var(--ink)] border-[var(--rule-strong)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-[11.5px] font-bold">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1.5 block">
                Your Email or Roll No (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 23EG10A0501 or name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium focus:outline-none focus:border-[var(--ink)] transition-colors placeholder:text-[var(--ink-faint)]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1.5 block">
                Message / Details
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe the notes you need or any problem you noticed..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3 text-[13.5px] font-medium focus:outline-none focus:border-[var(--ink)] transition-colors placeholder:text-[var(--ink-faint)] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!message.trim() || loading}
              className="w-full bg-[#D7E600] text-[var(--ink)] font-black text-[14px] py-3 rounded-xl border-[2px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center gap-2 hover:translate-y-[1px] transition-all disabled:opacity-50 mt-1 cursor-pointer"
            >
              {loading ? (
                <span>Sending...</span>
              ) : (
                <>
                  <span>Submit Feedback</span>
                  <SendIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

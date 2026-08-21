'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChevronLeftIcon, Loader2Icon } from 'lucide-react';

export default function ApplyPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const supabase = createClient();

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Sign up the user (trigger handles profile creation)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (authError) throw authError;
      
      // 2. Update their profile with college/department info and ensure role/status are correct
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            college,
            role: 'community_admin',
            status: 'pending' // Wait for superadmin approval
          })
          .eq('id', authData.user.id);
          
        if (profileError) throw profileError;
      }

      // 3. Redirect to pending page
      router.push('/community/pending');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to apply. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--paper-card)] min-h-screen">
      <div className="px-[18px] pt-4 pb-4 border-b border-[var(--rule)] bg-[var(--paper)]">
        <Link href="/" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <ChevronLeftIcon className="w-4 h-4" /> Back Home
        </Link>
      </div>

      <div className="px-[18px] py-8 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <h1 className="font-bold text-[24px] mb-2 text-center">Become a Contributor</h1>
        <p className="text-[13px] text-[var(--ink-soft)] text-center mb-8">
          Help your juniors by uploading notes and previous year papers. Applications are manually reviewed.
        </p>

        {error && (
          <div className="bg-[var(--red-bg)] text-[var(--red)] p-3 rounded-lg text-[13px] font-medium mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleApply} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              Full Name
            </label>
            <input 
              required
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Rahul Kumar"
              className="w-full border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--paper)] focus:outline-none focus:border-[var(--ink)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              College / University
            </label>
            <input 
              required
              type="text" 
              value={college}
              onChange={e => setCollege(e.target.value)}
              placeholder="e.g. Anurag University"
              className="w-full border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--paper)] focus:outline-none focus:border-[var(--ink)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              Email Address
            </label>
            <input 
              required
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="student@college.edu"
              className="w-full border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--paper)] focus:outline-none focus:border-[var(--ink)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input 
              required
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              className="w-full border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--paper)] focus:outline-none focus:border-[var(--ink)] transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full bg-[var(--hl)] text-[var(--hl-ink)] border-[2px] border-[var(--ink)] font-bold text-[15px] py-3 rounded-lg shadow-[2px_2px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex justify-center items-center gap-2"
          >
            {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : 'Submit Application'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[12px] text-[var(--ink-soft)]">
            Already an admin? <Link href="/community/login" className="text-[var(--ink)] font-bold underline">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

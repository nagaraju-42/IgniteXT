'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChevronLeftIcon, Loader2Icon } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      
      // Check role/status
      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', authData.user.id)
          .single();

        if (profile?.role === 'superadmin') {
          router.push('/admin');
          return;
        }

        if (profile?.status === 'pending') {
          router.push('/community/pending');
          return;
        }

        if (profile?.status === 'suspended') {
          throw new Error('Your account has been suspended.');
        }

        router.push('/community');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to login. Please check your credentials.');
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
        <h1 className="font-bold text-[24px] mb-2 text-center">Admin Login</h1>
        <p className="text-[13px] text-[var(--ink-soft)] text-center mb-8">
          Welcome back.
        </p>

        {error && (
          <div className="bg-[var(--red-bg)] text-[var(--red)] p-3 rounded-lg text-[13px] font-medium mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
              placeholder="Enter your password"
              className="w-full border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--paper)] focus:outline-none focus:border-[var(--ink)] transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full bg-[var(--ink)] text-[var(--paper)] border-[2px] border-[var(--ink)] font-bold text-[15px] py-3 rounded-lg shadow-[2px_2px_0_var(--ink-soft)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex justify-center items-center gap-2"
          >
            {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : 'Log In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[12px] text-[var(--ink-soft)]">
            Don't have an account? <Link href="/community/apply" className="text-[var(--ink)] font-bold underline">Apply to contribute</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

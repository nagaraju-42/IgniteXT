'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SettingsIcon, LogInIcon, BellIcon, HelpCircleIcon, LayoutDashboardIcon, LogOutIcon } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
      setLoading(false);
    }
    checkAuth();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.refresh();
  };

  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col">
      <h1 className="font-bold text-[19px] mb-6">Your Profile</h1>

      <div className="border-[1.5px] border-[var(--ink)] rounded-xl p-4 bg-[var(--paper-deep)] mb-6 text-center">
        {loading ? (
          <div className="text-[13px] text-[var(--ink-soft)] py-4">Checking profile...</div>
        ) : user ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--hl-deep)] border-[2px] border-[var(--ink)] mx-auto mb-3 flex items-center justify-center">
              <span className="font-display font-black text-[24px] text-[var(--ink)]">
                {profile?.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </span>
            </div>
            <div className="font-semibold text-[15px] mb-1">{profile?.full_name || 'Admin'}</div>
            <div className="text-[12px] text-[var(--ink-soft)] mb-1">
              {profile?.role === 'superadmin' ? 'Super Administrator' : 'Community Admin'}
            </div>
            <div className="text-[12px] text-[var(--ink-soft)] mb-4">{user.email}</div>
            
            <div className="flex flex-col gap-2">
              <Link href="/admin" className="btn btn-p w-full justify-center">
                <LayoutDashboardIcon className="w-4 h-4" /> Go to Admin Dashboard
              </Link>
              <button onClick={handleSignOut} className="btn w-full justify-center border-[1.5px] border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)]">
                <LogOutIcon className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--hl)] border-[2px] border-[var(--ink)] mx-auto mb-3 flex items-center justify-center">
              <span className="font-display font-black text-[24px] text-[var(--ink)]">?</span>
            </div>
            <div className="font-semibold text-[15px] mb-1">Not logged in</div>
            <div className="text-[12px] text-[var(--ink-soft)] mb-4">
              Login as a contributor to upload materials.
            </div>
            <Link href="/community/login" className="btn btn-p w-full justify-center">
              <LogInIcon className="w-4 h-4" /> Contributor Login
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-1 uppercase tracking-wide">
          Settings
        </p>
        
        <div className="flex items-center justify-between p-3 border-[1.5px] border-[var(--rule-strong)] rounded-lg bg-[var(--paper)] opacity-50">
          <div className="flex items-center gap-3">
            <BellIcon className="w-4 h-4 text-[var(--ink-soft)]" />
            <span className="text-[13px] font-medium">Push Notifications</span>
          </div>
          <div className="w-8 h-4 bg-[var(--paper-deep)] border-[1.5px] border-[var(--rule-strong)] rounded-full relative">
            <div className="w-3 h-3 bg-[var(--ink-soft)] rounded-full absolute left-0.5 top-0.5"></div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border-[1.5px] border-[var(--rule-strong)] rounded-lg bg-[var(--paper)] opacity-50">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-4 h-4 text-[var(--ink-soft)]" />
            <span className="text-[13px] font-medium">Clear Offline Cache</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border-[1.5px] border-[var(--rule-strong)] rounded-lg bg-[var(--paper)] mt-4 opacity-50">
          <div className="flex items-center gap-3">
            <HelpCircleIcon className="w-4 h-4 text-[var(--ink-soft)]" />
            <span className="text-[13px] font-medium">Help & Feedback</span>
          </div>
        </div>
      </div>
    </div>
  );
}

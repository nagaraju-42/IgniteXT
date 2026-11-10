'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LogInIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  UserIcon,
  SlidersHorizontalIcon,
  UploadCloudIcon,
  BookmarkIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, type StudentProfile } from '@/components/OnboardingModal';
import { getWebBookmarks } from '@/lib/bookmarks';

export function WebProfile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  const router = useRouter();
  const supabase = createClient();

  const loadStudentSpace = () => {
    try {
      const saved =
        localStorage.getItem('semkit_profile') ||
        localStorage.getItem('ignitext_profile') ||
        localStorage.getItem('semkit_user_profile');
      if (saved) {
        setStudentProfile(JSON.parse(saved));
        return;
      }
      const match = document.cookie.match(/(?:^|; )(?:semkit_profile|ignitext_profile)=([^;]*)/);
      if (match && match[1]) {
        setStudentProfile(JSON.parse(decodeURIComponent(match[1])));
      }
    } catch {
      // Ignore profile errors
    }
  };

  useEffect(() => {
    loadStudentSpace();
    setBookmarkCount(getWebBookmarks().length);

    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
      setLoading(false);
    }
    checkAuth();

    const handleProfileChange = () => loadStudentSpace();
    window.addEventListener('semkit_profile_changed', handleProfileChange);
    window.addEventListener('ignitext_profile_changed', handleProfileChange);
    return () => {
      window.removeEventListener('semkit_profile_changed', handleProfileChange);
      window.removeEventListener('ignitext_profile_changed', handleProfileChange);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.refresh();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display font-black text-[32px] sm:text-[38px] text-[var(--ink)] leading-none">
          YOUR ACADEMIC SPACE & PROFILE
        </h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
          Customize your default regulation, branch, semester, and manage bookmarks or contributor access.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Student Space Card */}
        <div className="border-2 border-[var(--ink)] rounded-2xl p-5 bg-[#FAF9F5] shadow-[4px_4px_0_var(--ink)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--rule)]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#D7E600] border-2 border-[var(--ink)] flex items-center justify-center shadow-xs">
                <UserIcon className="w-5 h-5 text-[var(--ink)]" />
              </div>
              <div>
                <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Student Space
                </div>
                <div className="font-mono font-black text-[16px] text-[var(--ink)]">
                  {studentProfile?.roll || 'Guest Mode (R22)'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-[11.5px] font-bold bg-[#D7E600] text-[var(--ink)] px-3.5 py-2 rounded-xl border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center gap-1.5 cursor-pointer hover:translate-y-[1px]"
            >
              <SlidersHorizontalIcon className="w-3.5 h-3.5" />
              <span>{studentProfile ? 'Edit Space' : 'Customize'}</span>
            </button>
          </div>

          {studentProfile ? (
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] rounded-xl p-3">
                <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase">Regulation</div>
                <div className="font-mono font-black text-[15px] text-[var(--ink)] mt-0.5">
                  {studentProfile.reg_code}
                </div>
              </div>
              <div className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] rounded-xl p-3">
                <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase">Branch</div>
                <div className="font-mono font-black text-[15px] text-[var(--ink)] mt-0.5">
                  {studentProfile.branch_code}
                </div>
              </div>
              <div className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] rounded-xl p-3">
                <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase">Semester</div>
                <div className="font-mono font-black text-[15px] text-[var(--ink)] mt-0.5">
                  Sem {studentProfile.sem}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">
              You are browsing in open Guest Mode. Optionally save your Hall Ticket Number and default Semester so your Exam Hub opens right to your subjects every visit.
            </p>
          )}
        </div>

        {/* Contributor / Admin Card */}
        <div className="border-2 border-[var(--ink)] rounded-2xl p-5 bg-[#FAF9F5] shadow-[4px_4px_0_var(--ink)]">
          {loading ? (
            <div className="text-[13px] text-[var(--ink-soft)] py-6 text-center">Checking session...</div>
          ) : user ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#D7E600] border-2 border-[var(--ink)] mx-auto mb-2.5 flex items-center justify-center">
                <span className="font-black text-[22px] text-[var(--ink)]">
                  {profile?.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </span>
              </div>
              <div className="font-bold text-[16px] mb-0.5">{profile?.full_name || 'Admin'}</div>
              <div className="text-[12px] text-[var(--ink-soft)] mb-1">
                {profile?.role === 'superadmin' ? 'Super Administrator' : 'Community Admin'}
              </div>
              <div className="text-[11px] font-mono text-[var(--ink-faint)] mb-4">{user.email}</div>

              <div className="flex flex-col gap-2">
                <Link href="/admin" className="btn btn-p w-full justify-center text-[13px]">
                  <LayoutDashboardIcon className="w-4 h-4" /> Go to Admin Dashboard
                </Link>
                <Link href="/community" className="btn btn-s w-full justify-center text-[13px]">
                  <UploadCloudIcon className="w-4 h-4" /> Contributor Hub
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn btn-s w-full justify-center text-[13px] cursor-pointer"
                >
                  <LogOutIcon className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-bold text-[16px] text-[var(--ink)]">Contributor & Admin Portal</div>
                <p className="text-[12.5px] text-[var(--ink-soft)] mt-1">
                  Sign in as an administrator or contributor to upload notes, manage exam timetables, or organize subjects.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/community/login" className="btn btn-p text-[12.5px]">
                  <LogInIcon className="w-4 h-4" /> Admin / Contributor Login
                </Link>
                <Link href="/admin" className="btn btn-s text-[12.5px]">
                  Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Study Links */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/saved"
          className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper-card)] hover:bg-[#D7E600]/30 transition-colors flex items-center gap-3"
        >
          <BookmarkIcon className="w-5 h-5 text-[var(--ink)] shrink-0" />
          <div>
            <div className="font-bold text-[14px] text-[var(--ink)]">
              Study Bookmarks ({bookmarkCount})
            </div>
            <div className="text-[11.5px] text-[var(--ink-soft)]">
              View pinned PDF notes and recent reading history
            </div>
          </div>
        </Link>

        <Link
          href="/support"
          className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper-card)] hover:bg-[#D7E600]/30 transition-colors flex items-center gap-3"
        >
          <HelpCircleIcon className="w-5 h-5 text-[var(--ink)] shrink-0" />
          <div>
            <div className="font-bold text-[14px] text-[var(--ink)]">
              Request Notes & Support
            </div>
            <div className="text-[11.5px] text-[var(--ink-soft)]">
              Missing a unit PDF or question paper? Request it here
            </div>
          </div>
        </Link>
      </div>

      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialProfile={studentProfile}
        onSave={(newProf) => {
          setStudentProfile(newProf);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

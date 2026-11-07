'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SettingsIcon,
  LogInIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  UserIcon,
  SlidersHorizontalIcon,
  CheckCircle2Icon,
  UploadCloudIcon,
  CameraIcon,
  SparklesIcon
} from "lucide-react";
import { OnboardingModal, StudentProfile } from "@/components/OnboardingModal";
import { HallTicketScannerModal } from "@/components/HallTicketScannerModal";
import { getExamTimetable } from "@/lib/hallTicketScanner";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [timetable, setTimetable] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const loadStudentSpace = () => {
    try {
      const saved = localStorage.getItem('semkit_profile') || localStorage.getItem('ignitext_profile');
      if (saved) {
        setStudentProfile(JSON.parse(saved));
        return;
      }
      const match = document.cookie.match(/(?:^|; )(?:semkit_profile|ignitext_profile)=([^;]*)/);
      if (match && match[1]) {
        setStudentProfile(JSON.parse(decodeURIComponent(match[1])));
      }
    } catch (e) {}
  };

  const loadTimetable = () => {
    try {
      setTimetable(getExamTimetable());
    } catch(e) {}
  };

  useEffect(() => {
    loadStudentSpace();
    loadTimetable();

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

    const handleProfileChange = () => {
      loadStudentSpace();
      loadTimetable();
    };

    window.addEventListener('semkit_profile_changed', handleProfileChange);
    window.addEventListener('ignitext_profile_changed', handleProfileChange);
    window.addEventListener('semkit_timetable_updated', loadTimetable);
    return () => {
      window.removeEventListener('semkit_profile_changed', handleProfileChange);
      window.removeEventListener('ignitext_profile_changed', handleProfileChange);
      window.removeEventListener('semkit_timetable_updated', loadTimetable);
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.refresh();
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem('semkit_offline_files');
      localStorage.removeItem('ignitext_offline_files');
      alert('Offline notes cache cleared.');
    } catch (e) {}
  };

  return (
    <div className="px-[18px] pt-4 pb-12 h-full flex flex-col">
      <h1 className="font-bold text-[20px] mb-5">Your Profile & Space</h1>

      {/* Student Space Card */}
      <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper)] mb-5 shadow-[3px_3px_0_var(--ink)]">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--rule)]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#D7E600] border-[1.5px] border-[var(--ink)] flex items-center justify-center shadow-sm">
              <UserIcon className="w-5 h-5 text-[var(--ink)]" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                Student Space
              </div>
              <div className="font-mono font-bold text-[15px] text-[var(--ink)]">
                {studentProfile?.roll || 'Not Set'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-[11px] font-bold bg-[#D7E600] text-[var(--ink)] px-3 py-1.5 rounded-xl border border-[var(--ink)] shadow-[1.5px_1.5px_0_var(--ink)] flex items-center gap-1 hover:translate-y-[1px] transition-all cursor-pointer"
          >
            <SlidersHorizontalIcon className="w-3.5 h-3.5" />
            <span>{studentProfile ? 'Edit Space' : 'Set Up Space'}</span>
          </button>
        </div>

        {studentProfile ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] rounded-xl p-2.5">
              <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Regulation</div>
              <div className="font-mono font-black text-[14px] text-[var(--ink)] mt-0.5">{studentProfile.reg_code}</div>
            </div>
            <div className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] rounded-xl p-2.5">
              <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Branch</div>
              <div className="font-mono font-black text-[14px] text-[var(--ink)] mt-0.5">{studentProfile.branch_code}</div>
            </div>
            <div className="bg-[var(--paper-deep)] border border-[var(--rule-strong)] rounded-xl p-2.5">
              <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Semester</div>
              <div className="font-mono font-black text-[14px] text-[var(--ink)] mt-0.5">Sem {studentProfile.sem}</div>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">
            Personalize your space once to load your semester subjects automatically every time you open SemKit.
          </p>
        )}
      </div>

      {/* Hall Ticket & Live Timetable Card */}
      <div className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[#D7E600]/20 mb-6 shadow-[3px_3px_0_var(--ink)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CameraIcon className="w-5 h-5 text-[var(--ink)]" />
            <h2 className="font-bold text-[14px] text-[var(--ink)]">
              Hall Ticket & Live Timetable
            </h2>
          </div>
          <span className="font-mono text-[9.5px] font-bold bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-full">
            AI-POWERED
          </span>
        </div>
        <p className="text-[11.5px] text-[var(--ink-soft)] mb-3 leading-relaxed">
          Scan your hall ticket photo using on-device ML Kit OCR & Gemini AI to automatically sort your subjects by exam date with live countdowns.
        </p>
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="w-full bg-[var(--paper)] hover:bg-[var(--paper-deep)] border-[1.5px] border-[var(--ink)] text-[var(--ink)] font-bold text-[12.5px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <CameraIcon className="w-4 h-4 text-[var(--ink)]" />
          <span>Scan / Update Hall Ticket</span>
        </button>

        {Object.keys(timetable).length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-[var(--rule-strong)]">
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--ink-soft)] mb-1.5">
              <span className="font-bold uppercase tracking-wider text-[var(--ink)]">Synced Exams</span>
              <span>{Object.keys(timetable).length} subjects scheduled</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.values(timetable).slice(0, 5).map((entry: any, i: number) => (
                <span 
                  key={i}
                  className="font-mono text-[10px] bg-[var(--paper)] border border-[var(--rule-strong)] px-2 py-0.5 rounded text-[var(--ink)] font-semibold"
                >
                  {entry.subject_code}: {entry.exam_date}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contributor / Admin Card */}
      <div className="border-[1.5px] border-[var(--rule-strong)] rounded-2xl p-4 bg-[var(--paper)] mb-6 text-center shadow-sm">
        {loading ? (
          <div className="text-[13px] text-[var(--ink-soft)] py-3">Checking account...</div>
        ) : user ? (
          <>
            <div className="w-14 h-14 rounded-full bg-[var(--hl-deep)] border-[2px] border-[var(--ink)] mx-auto mb-2.5 flex items-center justify-center">
              <span className="font-black text-[20px] text-[var(--ink)]">
                {profile?.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </span>
            </div>
            <div className="font-bold text-[15px] mb-0.5">{profile?.full_name || 'Admin'}</div>
            <div className="text-[11.5px] text-[var(--ink-soft)] mb-1">
              {profile?.role === 'superadmin' ? 'Super Administrator' : 'Community Admin'}
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-faint)] mb-4">{user.email}</div>
            
            <div className="flex flex-col gap-2">
              <Link href="/admin" className="btn btn-p w-full justify-center text-[13px]">
                <LayoutDashboardIcon className="w-4 h-4" /> Go to Admin Dashboard
              </Link>
              <Link href="/community" className="btn w-full justify-center border-[1.5px] border-[var(--rule-strong)] bg-[var(--paper-deep)] text-[var(--ink)] text-[13px]">
                <UploadCloudIcon className="w-4 h-4" /> Contributor Hub
              </Link>
              <button
                onClick={handleSignOut}
                className="btn w-full justify-center border-[1.5px] border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] text-[13px]"
              >
                <LogOutIcon className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-left">
              <div>
                <div className="font-bold text-[14px] text-[var(--ink)]">Contributor & Admin</div>
                <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                  Login to upload notes & manage taxonomy
                </div>
              </div>
              <Link
                href="/community/login"
                className="bg-[var(--ink)] text-[var(--paper)] font-bold text-[12px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                <LogInIcon className="w-3.5 h-3.5" />
                <span>Login</span>
              </Link>
            </div>
            <div className="border-t border-[var(--rule)] pt-2.5 flex items-center justify-between">
              <span className="text-[11px] text-[var(--ink-soft)] font-medium">Direct Access</span>
              <div className="flex items-center gap-2">
                <Link href="/admin" className="text-[11px] font-bold text-[var(--ink)] hover:underline">
                  Admin Dashboard
                </Link>
                <span className="text-[var(--ink-faint)]">·</span>
                <Link href="/community" className="text-[11px] font-bold text-[var(--ink)] hover:underline">
                  Contributor Hub
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Options */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1">
          App Settings
        </p>

        <button
          onClick={handleClearCache}
          className="flex items-center justify-between p-3.5 border-[1.5px] border-[var(--rule-strong)] rounded-xl bg-[var(--paper)] text-left hover:border-[var(--ink)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-4 h-4 text-[var(--ink-soft)]" />
            <div>
              <div className="text-[13px] font-bold text-[var(--ink)]">Clear Offline Notes Cache</div>
              <div className="text-[10.5px] text-[var(--ink-soft)]">Deletes cached PDF metadata to free space</div>
            </div>
          </div>
        </button>

        <Link
          href="/support"
          className="flex items-center justify-between p-3.5 border-[1.5px] border-[var(--rule-strong)] rounded-xl bg-[var(--paper)] hover:border-[var(--ink)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <HelpCircleIcon className="w-4 h-4 text-[var(--ink-soft)]" />
            <div>
              <div className="text-[13px] font-bold text-[var(--ink)]">Help, Feedback & Bug Report</div>
              <div className="text-[10.5px] text-[var(--ink-soft)]">Suggest a subject or report an issue</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialProfile={studentProfile}
        onSave={(newProf) => {
          setStudentProfile(newProf);
          setIsModalOpen(false);
        }}
      />

      {/* Hall Ticket Scanner Modal */}
      <HallTicketScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={(scanResult) => {
          loadTimetable();
          loadStudentSpace();
        }}
      />
    </div>
  );
}

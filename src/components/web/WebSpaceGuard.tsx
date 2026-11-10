'use client';

import React, { useEffect, useState } from 'react';
import { OnboardingModal, type StudentProfile } from '@/components/OnboardingModal';
import { readStudentSpaceProfile } from './WebSpaceCard';

/**
 * Ensures Web students complete Space Setup before browsing/searching directly on secondary routes,
 * matching APK mandatory personalization rules without breaking SSR static prerendering.
 */
export function WebSpaceGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    setProfile(readStudentSpaceProfile());
    setChecked(true);

    const onProfileChange = () => setProfile(readStudentSpaceProfile());
    window.addEventListener('semkit_profile_changed', onProfileChange);
    window.addEventListener('ignitext_profile_changed', onProfileChange);
    return () => {
      window.removeEventListener('semkit_profile_changed', onProfileChange);
      window.removeEventListener('ignitext_profile_changed', onProfileChange);
    };
  }, []);

  if (!checked) {
    return <>{children}</>;
  }

  if (!profile) {
    return (
      <>
        <div className="opacity-30 pointer-events-none select-none">{children}</div>
        <OnboardingModal
          isOpen={true}
          onSave={(newProf) => setProfile(newProf)}
        />
      </>
    );
  }

  return <>{children}</>;
}

'use client';

import { useEffect, useState } from 'react';
import { isApkBuild, isNativeApp } from './platform';

/**
 * Returns true inside Capacitor Android/iOS APK builds, false on regular Web browsers.
 */
export function useIsNativeApp(): boolean {
  const [nativeMode, setNativeMode] = useState<boolean>(isApkBuild);

  useEffect(() => {
    if (!isApkBuild && isNativeApp()) {
      setNativeMode(true);
    }
  }, []);

  return nativeMode;
}

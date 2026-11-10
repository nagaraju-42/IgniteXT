/**
 * Platform detection utility separating Native Capacitor APK vs Responsive Website.
 *
 * - `isApkBuild`: Compile-time flag injected by `scripts/build-apk.mjs` so SSR/static APK
 *   bundles compile directly into APK mode without web-shell hydration flashes.
 * - `isNativeApp()`: Returns true inside the Capacitor APK (both compile-time and runtime).
 */

export const isApkBuild = process.env.NEXT_PUBLIC_IS_APK_BUILD === 'true';

export function isNativeApp(): boolean {
  if (isApkBuild) return true;
  if (typeof window !== 'undefined') {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return true;
    }
  }
  return false;
}

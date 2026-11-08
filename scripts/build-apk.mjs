import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Preparing static export for Android APK...');
const apiAdminDir = path.resolve('src/app/api/admin');
const tempDir = path.resolve('.temp_api_admin');

let moved = false;
if (fs.existsSync(apiAdminDir)) {
  fs.renameSync(apiAdminDir, tempDir);
  moved = true;
}

try {
  console.log('Building static export (NEXT_EXPORT=true)...');
  execSync('npx next build --webpack', {
    stdio: 'inherit',
    env: { ...process.env, NEXT_EXPORT: 'true' }
  });
} finally {
  if (moved && fs.existsSync(tempDir)) {
    fs.renameSync(tempDir, apiAdminDir);
  }
}

console.log('Syncing Capacitor Android...');
execSync('npx cap sync android', { stdio: 'inherit' });

console.log('Assembling release APK with Gradle...');
execSync('cd android && .\\gradlew.bat assembleRelease', { stdio: 'inherit' });

console.log('Copying output APK to SemKit.apk...');
fs.copyFileSync('android/app/build/outputs/apk/release/app-release.apk', 'SemKit.apk');
console.log('SemKit.apk generated successfully!');

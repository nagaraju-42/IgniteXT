import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Preparing static export for Android APK...');
const apiDir = path.resolve('src/app/api');
const tempApiDir = path.resolve('.temp_api');

let moved = false;
if (fs.existsSync(apiDir)) {
  fs.renameSync(apiDir, tempApiDir);
  moved = true;
}

try {
  console.log('Building static export (NEXT_EXPORT=true, NEXT_PUBLIC_IS_APK_BUILD=true)...');
  execSync('npx next build --webpack', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_EXPORT: 'true',
      NEXT_PUBLIC_IS_APK_BUILD: 'true',
    },
  });
} finally {
  if (moved && fs.existsSync(tempApiDir)) {
    fs.renameSync(tempApiDir, apiDir);
  }
}

console.log('Syncing Capacitor Android...');
execSync('npx cap sync android', { stdio: 'inherit' });

console.log('Assembling release APK with Gradle...');
execSync('cd android && .\\gradlew.bat assembleRelease', { stdio: 'inherit' });

console.log('Copying output APK to SemKit.apk...');
fs.copyFileSync('android/app/build/outputs/apk/release/app-release.apk', 'SemKit.apk');
console.log('SemKit.apk generated successfully!');

const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

async function generateIcons() {
  const srcPath = 'C:/Users/NAGARAJU/.gemini/antigravity/brain/93cf142c-a410-4ff6-a901-a5c339eafee6/.user_uploaded/media_1794047910563_c911481d.jpg';
  const img = await Jimp.read(srcPath);

  // Crop the card: minX: 24, maxX: 438, minY: 271, maxY: 731
  // Card size: 414 x 460
  const card = img.clone().crop({ x: 24, y: 271, w: 414, h: 460 });

  // Create a 512x512 master square image with dark background #1a1a1a matching the card
  // Fill background with black/dark
  const master = new Jimp({ width: 512, height: 512, color: 0x1c1c1cff });
  
  // Resize card to fit nicely inside 512x512 (e.g. 460x512 or 414x460 centered)
  // Let's center card inside master
  const offsetX = Math.floor((512 - 414) / 2);
  const offsetY = Math.floor((512 - 460) / 2);
  master.composite(card, offsetX, offsetY);

  // Save master 512
  await master.write('C:/IgniteXT/public/master_icon.png');
  console.log('Saved master_icon.png');

  // Also save public/logo.png (used in header)
  await master.clone().resize({ w: 128, h: 128 }).write('C:/IgniteXT/public/logo.png');
  await master.clone().resize({ w: 128, h: 128 }).write('C:/IgniteXT/out/logo.png');
  console.log('Updated public/logo.png and out/logo.png');

  // Generate web icons
  fs.mkdirSync('C:/IgniteXT/public/icons', { recursive: true });
  fs.mkdirSync('C:/IgniteXT/out/icons', { recursive: true });

  const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const s of iconSizes) {
    const resized = master.clone().resize({ w: s, h: s });
    await resized.write(`C:/IgniteXT/public/icons/icon-${s}x${s}.png`);
    await resized.write(`C:/IgniteXT/out/icons/icon-${s}x${s}.png`);
  }
  console.log('Generated web icons');

  // Android mipmap sizes
  const androidMipmaps = [
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const m of androidMipmaps) {
    const dir = path.join('C:/IgniteXT/android/app/src/main/res', m.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const icon = master.clone().resize({ w: m.size, h: m.size });
    await icon.write(path.join(dir, 'ic_launcher.png'));
    await icon.write(path.join(dir, 'ic_launcher_round.png'));
    await icon.write(path.join(dir, 'ic_launcher_foreground.png'));
  }
  console.log('Generated Android mipmap launcher icons');

  // Android Splash Screen
  const splashMaster = new Jimp({ width: 1080, height: 1920, color: 0x1c1c1cff });
  const splashLogo = master.clone().resize({ w: 400, h: 400 });
  splashMaster.composite(splashLogo, (1080 - 400) / 2, (1920 - 400) / 2);

  const splashDirs = [
    'drawable',
    'drawable-port-hdpi',
    'drawable-port-mdpi',
    'drawable-port-xhdpi',
    'drawable-port-xxhdpi',
    'drawable-port-xxxhdpi',
  ];

  for (const sd of splashDirs) {
    const p = path.join('C:/IgniteXT/android/app/src/main/res', sd);
    if (fs.existsSync(p)) {
      await splashMaster.clone().resize({ w: 480, h: 800 }).write(path.join(p, 'splash.png'));
    }
  }
  console.log('Generated Android splash screens');
}

generateIcons().catch(console.error);

const Jimp = require('jimp');

async function processImage() {
  try {
    const imagePath = 'C:\\Users\\NAGARAJU\\.gemini\\antigravity\\brain\\93cf142c-a410-4ff6-a901-a5c339eafee6\\.user_uploaded\\media_1787310078920.png';
    const img = await Jimp.read(imagePath);
    
    // The image has the bulb box on the left, and text on the right.
    // The height of the image seems to be roughly the size of the box, with some margin.
    // Let's crop a square from the left side, centering on the bulb box.
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    
    // Crop a square from the left (x: 20, y: 0, w: h, h: h - assuming it's roughly square on the left)
    // Actually let's just make it a perfect square matching the height, starting from x=10 or x=20
    const cropSize = Math.floor(h * 0.95);
    const startX = Math.floor(w * 0.05); // slightly offset from left
    const startY = Math.floor((h - cropSize) / 2);
    
    img.crop(startX, startY, cropSize, cropSize);
    img.resize(1024, 1024);
    
    // Save the icon
    await img.writeAsync('C:\\IgniteXT\\icon.png');
    console.log('Successfully created icon.png (1024x1024)');
    
    // Create splash screen (2732x2732)
    // For splash screen, we can just use the full original image centered on a dark background
    const originalImg = await Jimp.read(imagePath);
    
    // Let's sample the background color from the top left corner
    const bgHex = originalImg.getPixelColor(1, 1);
    
    const splash = new Jimp(2732, 2732, bgHex);
    // scale original image up by 3x for splash
    originalImg.scale(3);
    const origW = originalImg.bitmap.width;
    const origH = originalImg.bitmap.height;
    
    splash.composite(originalImg, (2732 - origW) / 2, (2732 - origH) / 2);
    await splash.writeAsync('C:\\IgniteXT\\splash.png');
    console.log('Successfully created splash.png (2732x2732)');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

processImage();

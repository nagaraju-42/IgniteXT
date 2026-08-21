const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');
const { networkInterfaces } = require('os');

function getLocalIpAddress() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIpAddress();
const port = 3000;
const localUrl = `http://${ip}:${port}`;

console.log('\n\n======================================================');
console.log('🚀 IGNITEXT LOCAL DEVELOPMENT SERVER');
console.log('======================================================\n');
console.log(`Scan this QR code with your phone to test the app:\n`);
console.log(`🔗 Link: ${localUrl}\n`);

qrcode.generate(localUrl, { small: true });

console.log('======================================================\n');
console.log('Starting Next.js...');

const next = spawn('npx', ['next', 'dev', '-H', '0.0.0.0'], {
  stdio: 'inherit',
  shell: true
});

next.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
});

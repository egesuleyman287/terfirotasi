import QRCode from 'qrcode';

await QRCode.toFile(
  'C:\\Users\\suleyman\\Documents\\Codex\\2026-08-02\\merha\\outputs\\terfi-rotasi-iphone-test-qr.png',
  'exp://192.168.1.110:8081',
  { width: 720, margin: 3, color: { dark: '#153b5b', light: '#ffffff' } },
);

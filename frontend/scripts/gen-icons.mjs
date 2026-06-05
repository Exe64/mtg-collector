// Génère des icônes PWA PNG (couleur unie indigo). Remplaçables par un vrai logo.
//   node scripts/gen-icons.mjs
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, type RGB
  const row = Buffer.alloc(1 + size * 3); // octet 0 = filtre (none)
  for (let x = 0; x < size; x += 1) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Interpolation sur plusieurs paliers de couleur.
function lerpStops(stops, t) {
  const seg = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
  const local = t * (stops.length - 1) - seg;
  const a = stops[seg];
  const b = stops[seg + 1];
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * local);
}

// Bannière en dégradé diagonal multi-teintes + vignette bas (lisibilité du titre).
function bannerPng(w, h, stops) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    const row = Buffer.alloc(1 + w * 3);
    const yf = y / (h - 1);
    const vignette = 1 - Math.pow(yf, 2) * 0.55; // assombrit le bas
    for (let x = 0; x < w; x += 1) {
      const t = (x / (w - 1)) * 0.7 + yf * 0.3; // diagonale douce
      const [r, g, b] = lerpStops(stops, Math.min(t, 1));
      row[1 + x * 3] = Math.round(r * vignette);
      row[2 + x * 3] = Math.round(g * vignette);
      row[3 + x * 3] = Math.round(b * vignette);
    }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, [79, 70, 229]));
writeFileSync('public/icons/icon-512.png', png(512, [79, 70, 229]));
writeFileSync('public/banner.png', bannerPng(1600, 280, [
  [49, 46, 129],   // indigo profond
  [109, 40, 217],  // violet
  [30, 58, 138],   // bleu
  [15, 23, 42],    // slate
]));
console.log('Icônes + bannière générées dans public/');

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputs = [
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
];
const supersampling = 4;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function iconColor(x, y) {
  const book = inPolygon(x, y, [
    [0.22, 0.27],
    [0.38, 0.25],
    [0.5, 0.34],
    [0.62, 0.25],
    [0.78, 0.27],
    [0.78, 0.73],
    [0.62, 0.7],
    [0.5, 0.79],
    [0.38, 0.7],
    [0.22, 0.73],
  ]);
  const seam = Math.abs(x - 0.5) < 0.009 && y > 0.33 && y < 0.78;
  if (seam) return [23, 72, 78];
  if (book) return [240, 255, 251];
  const progress = Math.max(0, Math.min(1, (x + y) / 2));
  return [
    115 - Math.round(progress * 41),
    216 - Math.round(progress * 85),
    193 + Math.round(progress * 3),
  ];
}

function generate(size) {
  const renderSize = size * supersampling;
  const high = new Uint8Array(renderSize * renderSize * 4);
  for (let y = 0; y < renderSize; y += 1) {
    for (let x = 0; x < renderSize; x += 1) {
      const color = iconColor((x + 0.5) / renderSize, (y + 0.5) / renderSize);
      const offset = (y * renderSize + x) * 4;
      high.set([...color, 255], offset);
    }
  }
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        for (let sy = 0; sy < supersampling; sy += 1)
          for (let sx = 0; sx < supersampling; sx += 1)
            sum +=
              high[
                ((y * supersampling + sy) * renderSize +
                  x * supersampling +
                  sx) *
                  4 +
                  channel
              ];
        pixels[(y * size + x) * 4 + channel] = Math.round(
          sum / (supersampling * supersampling),
        );
      }
    }
  }
  return encodePng(size, pixels);
}

for (const [filename, size] of outputs) {
  writeFileSync(path.join(root, filename), generate(size));
  console.log(`Generated ${filename}`);
}

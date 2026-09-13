import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputs = [
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
];

const icon = `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#245a55"/>
    <circle cx="256" cy="256" r="164" fill="none" stroke="#94b8aa" stroke-width="2"/>
    <text x="256" y="309" text-anchor="middle" font-family="Georgia, serif" font-size="190" fill="#fffaf0">n.</text>
  </svg>
`;

for (const [filename, size] of outputs) {
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(path.join(root, filename));
  console.log(`Generated ${filename}`);
}

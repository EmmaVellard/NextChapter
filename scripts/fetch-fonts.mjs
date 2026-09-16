import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vendors the two brand faces into public/fonts so the build has no network
// dependency. next/font/google fetches at build time and fails the production
// build outright if Google is unreachable, which would break a deploy for a
// reason that has nothing to do with the change being deployed.
//
// Run once, and again only to update a face:  node scripts/fetch-fonts.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'public', 'fonts');

const FACES = [
  { file: 'fraunces-latin.woff2', query: 'Fraunces:wght@300..700' },
  { file: 'nunito-latin.woff2', query: 'Nunito:wght@300..700' },
];

// A modern UA is required or the API answers with legacy formats instead of woff2.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

/** Picks the woff2 URL of the `latin` subset from a Google Fonts CSS payload. */
function latinWoff2Url(css) {
  const blocks = css.split('@font-face').slice(1);
  const latin = blocks.find((block) => /unicode-range:[^;]*U\+0000/.test(block));
  const source = (latin ?? blocks[0])?.match(
    /url\((https:\/\/[^)]+\.woff2)\)/,
  );
  return source?.[1] ?? null;
}

await mkdir(outputDirectory, { recursive: true });

for (const face of FACES) {
  const cssResponse = await fetch(
    `https://fonts.googleapis.com/css2?family=${face.query}&display=swap`,
    { headers: { 'User-Agent': USER_AGENT } },
  );
  if (!cssResponse.ok) {
    throw new Error(
      `Could not read the stylesheet for ${face.query}: ${cssResponse.status}`,
    );
  }

  const url = latinWoff2Url(await cssResponse.text());
  if (!url) throw new Error(`No woff2 source found for ${face.query}`);

  const fontResponse = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!fontResponse.ok) {
    throw new Error(`Could not download ${url}: ${fontResponse.status}`);
  }

  const bytes = Buffer.from(await fontResponse.arrayBuffer());
  await writeFile(path.join(outputDirectory, face.file), bytes);
  console.log(`${face.file}  ${(bytes.byteLength / 1024).toFixed(0)} KB`);
}

console.log(`\nSaved to public/fonts. Commit these so the build stays offline.`);

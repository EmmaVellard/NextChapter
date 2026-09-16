import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the published artifact. A static export that builds successfully can
// still be broken for GitHub Pages: wrong base path, a missing service worker,
// or no 404 page (which made the worker cache an error page as the app shell).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'out');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/NextChapter';

const failures = [];

function requireFile(relativePath) {
  const filename = path.join(outputDirectory, relativePath);
  if (!existsSync(filename)) {
    failures.push(`missing ${relativePath}`);
    return null;
  }
  return filename;
}

if (!existsSync(outputDirectory)) {
  console.error('out/ does not exist. Run the production build first.');
  process.exit(1);
}

const indexPath = requireFile('index.html');
for (const asset of [
  '404.html',
  'sw.js',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
]) {
  requireFile(asset);
}

if (indexPath) {
  const html = readFileSync(indexPath, 'utf8');
  if (!html.includes(`${basePath}/_next/`)) {
    failures.push(
      `index.html does not reference ${basePath}/_next/ — the base path is not applied, so every asset would 404 on GitHub Pages`,
    );
  }
  if (!html.includes(`${basePath}/manifest.webmanifest`)) {
    failures.push('index.html does not link the base-path-aware manifest');
  }
}

const manifestPath = path.join(outputDirectory, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.start_url !== `${basePath}/`) {
    failures.push(
      `manifest start_url is ${manifest.start_url}, expected ${basePath}/`,
    );
  }
  if (manifest.scope !== `${basePath}/`) {
    failures.push(`manifest scope is ${manifest.scope}, expected ${basePath}/`);
  }
}

const workerPath = path.join(outputDirectory, 'sw.js');
if (existsSync(workerPath)) {
  const worker = readFileSync(workerPath, 'utf8');
  // Regression guard for the bug where any response, including a 404 page,
  // was stored as the offline app shell.
  if (!worker.includes('function isCacheable')) {
    failures.push('sw.js is missing the cacheable-response guard');
  }
}

if (failures.length > 0) {
  console.error('Static export verification failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Static export looks correct for base path ${basePath}`);

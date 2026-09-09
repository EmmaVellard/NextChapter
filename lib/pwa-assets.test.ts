import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PWA assets', () => {
  it('ships install icons and an offline shell', async () => {
    await Promise.all([
      access(path.join(process.cwd(), 'public/icon-192.png')),
      access(path.join(process.cwd(), 'public/icon-512.png')),
      access(path.join(process.cwd(), 'public/apple-touch-icon.png')),
    ]);
    const worker = await readFile(
      path.join(process.cwd(), 'public/sw.js'),
      'utf8',
    );
    expect(worker).toContain('next-chapter-shell-v3');
  });

  it('includes persistent light and dark theme controls', async () => {
    const [styles, toggle, layout] = await Promise.all([
      readFile(path.join(process.cwd(), 'app/globals.css'), 'utf8'),
      readFile(path.join(process.cwd(), 'components/theme-toggle.tsx'), 'utf8'),
      readFile(path.join(process.cwd(), 'app/layout.tsx'), 'utf8'),
    ]);

    expect(styles).toContain(':root {');
    expect(styles).toContain('.dark {');
    expect(toggle).toContain('next-chapter-theme');
    expect(layout).toContain('prefers-color-scheme: dark');
  });
});

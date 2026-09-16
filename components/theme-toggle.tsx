'use client';

import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('next-chapter-theme', theme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/55 grid size-11 place-items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:outline-none"
    >
      <Moon className="size-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-5 dark:block" aria-hidden="true" />
    </button>
  );
}

'use client';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('next-chapter-theme', theme);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 rounded-full bg-card/80"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // A previously installed production worker can otherwise serve an old
      // app shell over the local development build and cause hydration errors.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        );

      if ('caches' in window) {
        void caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter(
                  (key) =>
                    key.startsWith('next-chapter-shell-') ||
                    key.startsWith('book-companion-shell-'),
                )
                .map((key) => caches.delete(key)),
            ),
          );
      }
      return;
    }

    // A worker that activates mid-session swaps in a new build whose hashed
    // chunk names this page has never seen, so reload instead of letting it
    // request assets the server no longer has.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );

    let registration: ServiceWorkerRegistration | null = null;
    // Installed PWAs can stay resident for days without a page load, so check
    // for a new deploy whenever the app is brought back to the foreground.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void registration?.update().catch(() => {});
    };

    const register = () => {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const scope = `${basePath}/`;
      void navigator.serviceWorker
        .register(`${basePath}/sw.js`, { scope })
        .then((next) => {
          registration = next;
        })
        .catch(() => {});
    };

    document.addEventListener('visibilitychange', onVisible);

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }

    return () => {
      window.removeEventListener('load', register);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
    };
  }, []);

  return null;
}

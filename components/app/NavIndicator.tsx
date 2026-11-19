'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Loading from '@/components/Loading';

// A tap on a card goes to a server-rendered page whose data is fetched before it
// renders, so the screen would sit frozen until the response lands. The click is
// the earliest signal we get, so it arms the indicator; the route change disarms
// it. The short delay keeps quick, prefetched navigations from flashing it.
const DELAY_MS = 120;
// A navigation that never lands (dropped connection, cancelled request) must not
// leave the frame covered: the overlay intercepts taps, so it would trap the app.
const FAILSAFE_MS = 10_000;

export default function NavIndicator() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState(false);
  const timer = useRef<number | null>(null);

  // However the navigation finishes, arriving at a new URL hides the indicator.
  useEffect(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setPending(false);
  }, [pathname, search]);

  // Whatever goes wrong with the request, the overlay lifts on its own.
  useEffect(() => {
    if (!pending) return;
    const failsafe = window.setTimeout(() => setPending(false), FAILSAFE_MS);
    return () => window.clearTimeout(failsafe);
  }, [pending]);

  useEffect(() => {
    function arm(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      const href = anchor?.getAttribute('href') ?? '';
      // Only same-site paths: external links leave the app and keep no state.
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const target = anchor?.getAttribute('target');
      if (target && target !== '_self') return;
      const next = new URL(href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) {
        return;
      }

      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setPending(true), DELAY_MS);
    }

    // Capture on the document so links rendered anywhere in the shell are seen.
    document.addEventListener('click', arm, true);
    return () => {
      document.removeEventListener('click', arm, true);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="m-nav-loading">
      <Loading />
    </div>
  );
}

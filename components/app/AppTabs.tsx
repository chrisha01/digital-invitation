'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/app',
    label: 'Invitations',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.2 6.6 12 12.6l7.8-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/app/designs',
    label: 'Designs',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path d="M12 3.8 20.2 12 12 20.2 3.8 12z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/app/create',
    label: 'Create',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/app/account',
    label: 'Account',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <circle cx="12" cy="9" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.4 19.2c.9-3.2 3.4-5 6.6-5s5.7 1.8 6.6 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AppTabs({ always = false }: { always?: boolean }) {
  const pathname = usePathname();
  // Invitation pages hide the bar to keep the detail view focused, but a page
  // that is not there has nowhere to go, so it asks for the bar regardless.
  if (!always && pathname.startsWith('/app/i/')) return null;

  return (
    <nav className="m-tabs" aria-label="App sections">
      {TABS.map((tab) => {
        const active = tab.href === '/app' ? pathname === '/app' : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`m-tab${active ? ' is-active' : ''}`}>
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

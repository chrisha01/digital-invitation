'use client';

import { usePathname } from 'next/navigation';
import AppTabs from './AppTabs';

// The layout keeps the bar off invitation paths. A not-found page can still be
// reached under one of them, where the layout's copy is gone, so supply it then.
export default function TabsWhenHidden() {
  const pathname = usePathname();
  if (!pathname.startsWith('/app/i/')) return null;
  return <AppTabs always />;
}

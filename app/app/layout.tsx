import type { ReactNode } from 'react';
import AppTabs from '@/components/app/AppTabs';
import NavIndicator from '@/components/app/NavIndicator';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Gatherly app',
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="m-app">
      <div className="m-body">
        <div className="m-scroll">{children}</div>
        <NavIndicator />
      </div>
      <AppTabs />
    </div>
  );
}

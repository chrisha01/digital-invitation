'use client';

import Link from 'next/link';
import AppPanel from '@/components/app/AppPanel';
import TabsWhenHidden from '@/components/app/TabsWhenHidden';

export default function AppError() {
  return (
    <div className="m-notfound">
      <AppPanel
        title="Something went wrong"
        reason="This page couldn’t be loaded just now. It’s usually temporary."
        panelTitle="Nothing to show"
        note="Your invitations, guests and replies are all safe."
      >
        <div className="m-notfound-actions">
          {/* reset() re-renders from the data that already failed; a reload
              asks the server again, which is what a retry needs. */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <Link className="btn btn-ghost" href="/app">
            Back to invitations
          </Link>
        </div>
      </AppPanel>
      <TabsWhenHidden />
    </div>
  );
}

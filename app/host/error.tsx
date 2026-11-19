'use client';

import Link from 'next/link';
import HostPanel from '@/components/host/HostPanel';

export default function HostError() {
  return (
    <HostPanel
      label="Something went wrong"
      title="This page didn’t load"
      body="The dashboard couldn’t be put together just now. It’s usually temporary, and nothing you saved has been lost."
    >
      {/* reset() re-renders from the data that already failed; a reload asks
          the server again, which is what a retry needs. */}
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        Try again
      </button>
      <Link className="btn btn-ghost" href="/app">
        Back to your invitations
      </Link>
    </HostPanel>
  );
}

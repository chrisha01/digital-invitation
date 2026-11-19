'use client';

import Link from 'next/link';
import HostPanel from '@/components/host/HostPanel';

export default function CreateError() {
  return (
    <HostPanel
      label="Something went wrong"
      title="The editor didn’t open"
      body="This invitation couldn’t be loaded for editing just now. It’s usually temporary, and the invitation itself is safe."
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

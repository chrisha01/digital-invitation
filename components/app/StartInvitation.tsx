'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

export default function StartInvitation({
  design,
  className = 'btn btn-primary',
  busyLabel = 'Starting…',
  children,
}: {
  design?: string;
  className?: string;
  busyLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ design }),
      });
      const body = (await response.json().catch(() => null)) as
        | { invitation?: { id: string }; error?: string }
        | null;
      if (!response.ok || !body?.invitation) {
        throw new Error(body?.error ?? 'Could not start that invitation.');
      }
      router.push(`/app/i/${body.invitation.id}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not start that invitation.');
      setBusy(false);
    }
  }

  return (
    <span className="m-start">
      <button type="button" className={className} onClick={() => void start()} disabled={busy}>
        {busy ? busyLabel : children}
      </button>
      {error ? <span className="m-error">{error}</span> : null}
    </span>
  );
}

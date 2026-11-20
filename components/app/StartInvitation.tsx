'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';

export default function StartInvitation({
  design,
  className = 'btn btn-primary',
  busyLabel = 'Starting…',
  destination = 'app',
  ariaLabel,
  children,
}: {
  design?: string;
  className?: string;
  busyLabel?: string;
  /** 'app' opens the app's invitation page; 'editor' opens the web card editor. */
  destination?: 'app' | 'editor';
  ariaLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not just the disabled attribute: two clicks in one tick both see the
  // old state and would create two invitations.
  const starting = useRef(false);

  async function start() {
    if (starting.current) return;
    starting.current = true;
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
      const { id } = body.invitation;
      router.push(destination === 'editor' ? `/create?id=${id}` : `/app/i/${id}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not start that invitation.');
      starting.current = false;
      setBusy(false);
    }
  }

  return (
    <span className="m-start">
      <button
        type="button"
        className={className}
        onClick={() => void start()}
        disabled={busy}
        aria-label={ariaLabel}
      >
        {busy ? busyLabel : children}
      </button>
      {error ? <span className="m-error">{error}</span> : null}
    </span>
  );
}

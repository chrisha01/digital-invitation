'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Deleting an invitation throws away its guest list and replies, so the first
 * click only arms the button and names what will go.
 */
export default function DeleteInvitationButton({
  id,
  title,
  redirectTo,
  label = 'Delete',
}: {
  id: string;
  title: string;
  redirectTo?: string;
  label?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warningId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // The button the user pressed is replaced, so hand focus to its successor.
  useEffect(() => {
    if (armed) confirmRef.current?.focus();
  }, [armed]);

  async function remove() {
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      setError('Could not delete this invitation. Try again.');
    }
  }

  if (!armed) {
    return (
      <button className="btn btn-ghost btn-small" onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="delete-confirm">
      {/* Arming swaps the button for a red one, so say out loud what the second
          press does — the visual change alone is invisible to a screen reader. */}
      <span className="sr-only" role="status" id={warningId}>
        Delete armed. Press Delete again to permanently delete “{title}”, or Keep to cancel.
      </span>
      <button
        ref={confirmRef}
        className="btn btn-danger btn-small"
        onClick={remove}
        aria-describedby={warningId}
      >
        Delete “{title.slice(0, 28)}{title.length > 28 ? '…' : ''}”
      </button>
      <button className="btn btn-ghost btn-small" onClick={() => setArmed(false)}>
        Keep
      </button>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

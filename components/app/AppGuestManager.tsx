'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import CopyFallback from '@/components/CopyFallback';
import { useCopy } from '@/components/useCopy';
import type { Guest, Invitation, RsvpStatus } from '@/lib/types';

const STATUS_LABEL: Record<RsvpStatus, string> = {
  yes: 'Attending',
  no: 'Declined',
  maybe: 'Maybe',
  invited: 'Invited',
};

async function readGuests(response: Response): Promise<Guest[]> {
  const body = (await response.json().catch(() => null)) as
    | { guests?: Guest[]; error?: string }
    | null;
  if (!response.ok || !body?.guests) {
    throw new Error(body?.error ?? 'That did not save. Please try again.');
  }
  return body.guests;
}

/** Guest list, replies and door check-in, sized for the phone. */
export default function AppGuestManager({
  initial,
  guestLinks = {},
  origin = '',
}: {
  initial: Invitation;
  /** Signatures for each guest's personal link, issued by the server. */
  guestLinks?: Record<string, string>;
  /** Absolute base for the link, so it can be texted as-is. */
  origin?: string;
}) {
  const [guests, setGuests] = useState<Guest[]>(initial.guests);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [household, setHousehold] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { copy: clipboardCopy, outcome: copyOutcome, clear: clearCopy } = useCopy();
  const router = useRouter();

  const counts = useMemo(() => {
    const attending = guests.filter((guest) => guest.status === 'yes').length;
    const checked = guests.filter((guest) => guest.checkedInAt).length;
    return { invited: guests.length, attending, checked };
  }, [guests]);

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    setError(null);
    try {
      const next = await readGuests(
        await fetch(`/api/invitations/${initial.id}/guests`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, email, household }),
        }),
      );
      setGuests(next);
      setName('');
      setEmail('');
      setHousehold('');
      // A new guest's personal link is signed by the server, so refresh to
      // receive its token.
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not add that guest.');
    } finally {
      setAdding(false);
    }
  }

  async function setStatus(guest: Guest, status: RsvpStatus) {
    setBusy(guest.id);
    setError(null);
    try {
      setGuests(
        await readGuests(
          await fetch(`/api/invitations/${initial.id}/guests`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ guestId: guest.id, patch: { status } }),
          }),
        ),
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not save.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleCheckIn(guest: Guest) {
    setBusy(guest.id);
    setError(null);
    try {
      setGuests(
        await readGuests(
          await fetch(`/api/invitations/${initial.id}/checkin`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ guestId: guest.id, undo: Boolean(guest.checkedInAt) }),
          }),
        ),
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not save.');
    } finally {
      setBusy(null);
    }
  }

  async function copyGuestLink(guest: Guest) {
    const token = guestLinks[guest.id];
    if (!token) return;
    clearCopy();
    const path = `/i/${initial.id}?g=${encodeURIComponent(guest.id)}&t=${token}`;
    const result = await clipboardCopy(origin ? `${origin}${path}` : path);
    if (result?.outcome === 'copied') {
      setCopied(guest.id);
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  return (
    <main className="m-page">
      <Link href={`/app/i/${initial.id}`} className="m-back">
        ‹ Invitation
      </Link>

      <header className="m-head">
        <p className="m-eyebrow">{initial.title || initial.event.title}</p>
        <h1 className="m-title">Guests</h1>
        <p className="m-sub">Replies and the door, in one place.</p>
      </header>

      <div className="m-stats">
        <div className="m-stat">
          <span>{counts.invited}</span>
          <small>Invited</small>
        </div>
        <div className="m-stat">
          <span>{counts.attending}</span>
          <small>Attending</small>
        </div>
        <div className="m-stat">
          <span>{counts.checked}</span>
          <small>Checked in</small>
        </div>
      </div>

      <section className="m-panel">
        <h2>Add a guest</h2>
        <form onSubmit={(e) => void addGuest(e)} className="m-form">
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span className="field-label">
              Household <span className="muted">(optional)</span>
            </span>
            <input
              className="input"
              value={household}
              onChange={(e) => setHousehold(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add guest'}
          </button>
        </form>
      </section>

      {error ? <p className="m-error">{error}</p> : null}

      <section className="m-group">
        <h2 className="m-group-title">Guest list · {guests.length}</h2>
        {guests.length === 0 ? (
          <div className="m-empty">
            <h2>No guests yet</h2>
            <p>Add the first name above and the list starts here.</p>
          </div>
        ) : (
          <ul className="m-guests">
            {guests.map((guest) => (
              <li key={guest.id} className="m-guest-row">
                <span className="m-guest-name">
                  {guest.name}
                  {guest.household ? <small>{guest.household}</small> : null}
                </span>
                <span className="m-guest-controls">
                  <select
                    className="m-select"
                    value={guest.status}
                    disabled={busy === guest.id}
                    onChange={(e) => void setStatus(guest, e.target.value as RsvpStatus)}
                    aria-label={`Reply from ${guest.name}`}
                  >
                    {(['invited', 'yes', 'maybe', 'no'] as const).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`btn btn-small ${guest.checkedInAt ? 'btn-ghost' : 'btn-primary'}`}
                    disabled={busy === guest.id}
                    onClick={() => void toggleCheckIn(guest)}
                  >
                    {guest.checkedInAt ? 'Checked in ✓' : 'Check in'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={!guestLinks[guest.id]}
                    aria-label={`Copy ${guest.name}'s personal link`}
                    onClick={() => void copyGuestLink(guest)}
                  >
                    {copied === guest.id ? 'Copied' : 'Copy link'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {copyOutcome && copyOutcome.outcome === 'failed' ? (
        <CopyFallback outcome={copyOutcome} />
      ) : null}

      <p className="m-note">
        A personal link opens the invitation with this guest&rsquo;s name on the reply form and
        their entry pass.
      </p>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  autoSeat,
  chairPoints,
  markSeated,
  markUnseated,
  newTable,
  partySize,
  placeGuest,
  removeTable,
  resolveSeating,
  resizeTable,
  seatedGuestIds,
  tableLoad,
  tableParties,
  usableSeats,
} from '@/lib/seating';
import type { Invitation, SeatingPlan } from '@/lib/types';

type Status = 'saved' | 'saving' | 'retrying';

function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && !/^[&+]?$/.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** A chair can outlive its guest; this is what it says then. */
const UNKNOWN_GUEST = 'Unknown guest';

/** The exact body the seating API takes, so an untouched plan never re-saves. */
const payload = (plan: SeatingPlan) =>
  JSON.stringify({
    tables: plan.tables,
    items: plan.items ?? [],
    snapshot: plan.snapshot ?? {},
    finalized: Boolean(plan.finalized),
  });

/**
 * The seating plan for the phone: name the room's tables, seat each party from
 * a menu and publish the plan. The floor plan, venue items and drag-to-seat
 * stay in the full editor.
 */
export default function AppSeatingPlan({ initial }: { initial: Invitation }) {
  const byId = useMemo(
    () => new Map(initial.guests.map((guest) => [guest.id, guest])),
    [initial.guests],
  );
  const [plan, setPlan] = useState<SeatingPlan>(() => resolveSeating(initial.seating, byId));
  const [status, setStatus] = useState<Status>('saved');
  const [attempt, setAttempt] = useState<{ guestId: string; tableId: string } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const lastSaved = useRef(payload(plan));
  const latest = useRef(plan);
  latest.current = plan;

  const attending = useMemo(
    () => initial.guests.filter((guest) => guest.status === 'yes'),
    [initial.guests],
  );
  const seated = useMemo(() => seatedGuestIds(plan), [plan]);
  const unseated = attending.filter((guest) => !seated.has(guest.id));
  const totalSeats = plan.tables.reduce((sum, table) => sum + table.seats, 0);
  const totalHeads = attending.reduce((sum, guest) => sum + partySize(guest), 0);
  const awaiting = initial.guests.filter((guest) => guest.status === 'invited').length;

  const guidance = useMemo(() => {
    if (!attending.length) {
      return 'No one has accepted yet. Parties appear here as replies come in.';
    }
    if (!plan.tables.length) {
      return 'Add a table, then send each party to it. The plan saves as you go.';
    }
    if (unseated.length) {
      const chairs = unseated.length === 1 ? 'guest still needs' : 'guests still need';
      return `${unseated.length} attending ${chairs} a chair. Seat everyone to fill the room, or pick a table party by party.`;
    }
    if (awaiting) {
      return plan.finalized
        ? `Seated guests can see their table. ${awaiting} ${awaiting === 1 ? 'guest has' : 'guests have'} not replied yet — seat them when they do.`
        : `${awaiting} ${awaiting === 1 ? 'guest has' : 'guests have'} not replied yet. Mark the plan final when the last replies arrive.`;
    }
    return plan.finalized
      ? 'The plan is final. Each guest sees their table on the invitation.'
      : 'Everyone who replied has a chair. Mark the plan final when you are happy.';
  }, [attending.length, plan.tables.length, plan.finalized, unseated.length, awaiting]);

  async function save(data: SeatingPlan): Promise<boolean> {
    const body = payload(data);
    setStatus('saving');
    try {
      const res = await fetch(`/api/invitations/${initial.id}/seating`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (res.ok) lastSaved.current = body;
      setStatus(res.ok ? 'saved' : 'retrying');
      return res.ok;
    } catch {
      setStatus('retrying');
      return false;
    }
  }

  useEffect(() => {
    const body = payload(plan);
    if (body === lastSaved.current) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    // A failed save keeps trying with a growing pause. The next edit starts a
    // fresh chain, so the retry always carries the newest plan.
    const run = async () => {
      const ok = await save(plan);
      if (cancelled || ok) return;
      attempt += 1;
      timer = setTimeout(run, Math.min(15000, 800 * 2 ** (attempt - 1)));
    };
    timer = setTimeout(run, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // A hidden page is one the browser may kill: send what is unsent now.
  useEffect(() => {
    const flush = () => {
      const body = payload(latest.current);
      if (body === lastSaved.current) return;
      lastSaved.current = body;
      void fetch(`/api/invitations/${initial.id}/seating`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
    };
  }, [initial.id]);

  // Leaving quickly must not drop the last change before the debounce fires.
  useEffect(
    () => () => {
      const body = payload(latest.current);
      if (body === lastSaved.current) return;
      lastSaved.current = body;
      void fetch(`/api/invitations/${initial.id}/seating`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
    },
    [initial.id],
  );

  // Every edit reads the latest plan inside the updater, so two quick taps
  // (a chair added while a party is seated) cannot undo each other.
  function seatAt(guestId: string, tableId: string, chair = 0) {
    const guest = byId.get(guestId);
    const size = guest ? partySize(guest) : 1;
    setPlan((prev) => {
      const placed = placeGuest(prev, guestId, tableId || null, chair, size);
      const landed = placed.tables.some((table) => table.chairs.includes(guestId));
      return landed ? markSeated(placed, guestId, size) : markUnseated(placed, guestId);
    });
    setAttempt(tableId ? { guestId, tableId } : null);
    setHint(null);
  }

  // A party that no table could take stays unseated; say so rather than leaving
  // the menu silently back on "Unseated".
  const stranded =
    attempt &&
    byId.has(attempt.guestId) &&
    !plan.tables.some(
      (table) => table.id === attempt.tableId && table.chairs.includes(attempt.guestId),
    )
      ? attempt
      : null;
  const strandedSize = stranded ? partySize(byId.get(stranded.guestId)!) : 1;

  function addTable() {
    setPlan((prev) => ({ ...prev, tables: [...prev.tables, newTable(prev.tables.length)] }));
  }

  function changeSeats(tableId: string, delta: number) {
    setPlan((prev) => {
      const table = prev.tables.find((option) => option.id === tableId);
      return table ? resizeTable(prev, tableId, table.seats + delta) : prev;
    });
  }

  return (
    <main className="m-page">
      <Link href={`/app/i/${initial.id}`} className="m-back">
        ‹ Invitation
      </Link>

      <header className="m-head">
        <p className="m-eyebrow">Seating</p>
        <h1 className="m-title">The room</h1>
        <p className="m-sub">
          {plan.tables.length} {plan.tables.length === 1 ? 'table' : 'tables'} · {totalSeats} chairs
          · {totalHeads} attending
        </p>
        <span className={`m-edit-live is-${status}`}>
          {status === 'saved'
            ? 'Saved'
            : status === 'saving'
              ? 'Saving…'
              : 'Not saved — retrying…'}
        </span>
      </header>

      <p className="m-note">{guidance}</p>

      {stranded ? (
        <p className="m-error">
          That table has no {strandedSize === 1 ? 'free chair' : `run of ${strandedSize} free chairs`}.
          Add chairs or pick another table.
        </p>
      ) : null}

      <section className="m-panel">
        <div className="m-panel-head">
          <h2>The room</h2>
          <span className="m-table-load">
            {plan.tables.length} {plan.tables.length === 1 ? 'table' : 'tables'}
          </span>
        </div>

        {plan.tables.length === 0 && !(plan.items ?? []).length ? (
          <p>The room is empty. Add a table and it is drawn here.</p>
        ) : (
          <div className="m-floor-scroll">
            <div className="m-floor">
              {(plan.items ?? []).map((item) => (
                <div
                  key={item.id}
                  className="venue-item"
                  data-shape={item.shape}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.w}%`,
                    height: `${item.h}%`,
                    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                  }}
                >
                  <span>{item.label}</span>
                </div>
              ))}

              {plan.tables.map((table) => {
                const names = tableParties(table).map(
                  (id) => byId.get(id)?.name ?? UNKNOWN_GUEST,
                );
                const points = chairPoints(table);
                return (
                  <div
                    key={table.id}
                    className={`seat-table is-${table.shape}`}
                    style={{
                      left: `${table.x}%`,
                      top: `${table.y}%`,
                      transform: `translate(-50%, -50%) rotate(${table.rotation ?? 0}deg)`,
                    }}
                  >
                    <span className="seat-table-name">{table.name}</span>
                    <span className="seat-table-load">
                      {tableLoad(table)}
                      <span className="seat-table-of"> / {table.seats}</span>
                    </span>
                    <span className="seat-table-parties">
                      {names.length ? names.join(', ') : 'Every chair free'}
                    </span>

                    {table.chairs.map((occupantId, index) => {
                      const guest = occupantId ? byId.get(occupantId) : null;
                      // Taken, but by a guest who is no longer on the list.
                      const orphan = Boolean(occupantId) && !guest;
                      const previous =
                        table.chairs[(index - 1 + table.chairs.length) % table.chairs.length];
                      const continued = Boolean(occupantId) && previous === occupantId;
                      const held = index >= usableSeats(table);
                      const who = held
                        ? 'held spare'
                        : guest?.name ?? (orphan ? 'unknown guest' : 'empty');
                      const point = points[index];
                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={held}
                          className={[
                            'seat-chair',
                            occupantId ? 'is-taken' : '',
                            orphan ? 'is-orphan' : '',
                            continued ? 'is-continued' : '',
                            held ? 'is-spare' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{ left: `${point.left}%`, top: `${point.top}%` }}
                          aria-label={`${table.name}, chair ${index + 1}, ${who}`}
                          onClick={() => {
                            if (occupantId) {
                              seatAt(occupantId, '');
                              return;
                            }
                            if (!picked) {
                              setHint('Pick a party below, then tap a chair.');
                              return;
                            }
                            seatAt(picked, table.id, index);
                          }}
                        >
                          {occupantId
                            ? continued
                              ? '·'
                              : guest
                                ? initials(guest.name)
                                : '?'
                            : held
                              ? '–'
                              : index + 1}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="m-note">
          {hint ??
            (picked
              ? `Tap a chair to seat ${byId.get(picked)?.name ?? 'that party'} — tap a taken chair to lift them out.`
              : (
                  <>
                    <span className="m-floor-hint-narrow">Swipe the room to see all of it. </span>
                    Tap a party below, then tap a chair.
                  </>
                ))}
        </p>
      </section>

      <section className="m-panel">
        <div className="m-panel-head">
          <h2>Tables</h2>
          <button type="button" className="btn btn-ghost btn-small" onClick={addTable}>
            Add table
          </button>
        </div>

        {plan.tables.length === 0 ? (
          <p>No tables yet. Add a table, then send each party to it.</p>
        ) : (
          plan.tables.map((table) => {
            const names = tableParties(table)
              .map((id) => byId.get(id)?.name)
              .filter(Boolean);
            return (
              <div className="m-table-card" key={table.id}>
                <div className="m-table-head">
                  <strong>{table.name}</strong>
                  <span className="m-table-load">
                    {tableLoad(table)} / {table.seats}
                  </span>
                </div>
                <p className="m-table-names">{names.length ? names.join(', ') : 'Every chair free'}</p>
                <div className="m-table-tools">
                  <button
                    type="button"
                    className="m-step"
                    aria-label={`One fewer chair at ${table.name}`}
                    disabled={table.seats <= 2}
                    onClick={() => changeSeats(table.id, -1)}
                  >
                    −
                  </button>
                  <span className="m-table-seats">{table.seats} chairs</span>
                  <button
                    type="button"
                    className="m-step"
                    aria-label={`One more chair at ${table.name}`}
                    disabled={table.seats >= 20}
                    onClick={() => changeSeats(table.id, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => setPlan((prev) => removeTable(prev, table.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}

        <button
          type="button"
          className="btn btn-primary"
          disabled={!plan.tables.length || !attending.length}
          onClick={() => {
            setPlan((prev) => autoSeat(prev.tables, attending));
            setAttempt(null);
          }}
        >
          Seat everyone
        </button>
      </section>

      <section className="m-panel">
        <h2>{plan.finalized ? 'Seating is final' : 'Seats hidden from guests'}</h2>
        <p>
          {plan.finalized
            ? 'Guests see their table on the invitation.'
            : 'Guests see no table on the invitation until you mark the plan final.'}
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!plan.tables.length}
          onClick={() => setPlan((prev) => ({ ...prev, finalized: !prev.finalized }))}
        >
          {plan.finalized ? 'Stop showing seating' : 'Mark seating final'}
        </button>
      </section>

      <section className="m-group">
        <h2 className="m-group-title">Parties · {attending.length}</h2>
        {attending.length === 0 ? (
          <div className="m-empty">
            <h2>No replies yet</h2>
            <p>Only guests who said yes are seated. Their replies appear here.</p>
          </div>
        ) : (
          <ul className="m-guests">
            {attending.map((guest) => {
              const table = plan.tables.find((option) => option.chairs.includes(guest.id));
              const size = partySize(guest);
              return (
                <li key={guest.id} className="m-guest-row">
                  <button
                    type="button"
                    className={`m-party-pick${picked === guest.id ? ' is-picked' : ''}`}
                    aria-pressed={picked === guest.id}
                    onClick={() => {
                      setPicked(picked === guest.id ? null : guest.id);
                      setHint(null);
                    }}
                  >
                    {guest.name}
                    <small>
                      {size} {size === 1 ? 'chair' : 'chairs'}
                    </small>
                  </button>
                  <span className="m-guest-controls">
                    <select
                      className="m-select"
                      aria-label={`Table for ${guest.name}`}
                      value={table?.id ?? ''}
                      onChange={(e) => seatAt(guest.id, e.target.value)}
                    >
                      <option value="">Unseated</option>
                      {plan.tables.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="m-note">
        The floor plan, venue items and drag-to-seat are in the full editor.
      </p>
    </main>
  );
}

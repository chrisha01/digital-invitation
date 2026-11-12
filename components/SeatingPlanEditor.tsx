'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import {
  autoSeat,
  markSeated,
  markUnseated,
  newTable,
  newVenueItem,
  partySize,
  placeGuest,
  removeTable,
  reseatDrifted,
  resizeTable,
  resolveSeating,
  seatingDrift,
  seatedGuestIds,
  tableLoad,
  tableParties,
  usableSeats,
} from '@/lib/seating';
import type { SeatMode } from '@/lib/seating';
import type {
  Guest,
  Invitation,
  SeatShape,
  SeatTable,
  SeatingPlan,
  VenueItem,
  VenueShape,
} from '@/lib/types';

const SHAPES: { id: SeatShape; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'long', label: 'Long' },
  { id: 'square', label: 'Square' },
];

const VENUE_SHAPES: { id: VenueShape; label: string }[] = [
  { id: 'rect', label: 'Block' },
  { id: 'round', label: 'Round' },
  { id: 'soft', label: 'Soft' },
];

const VENUE_PRESETS: { label: string; shape: VenueShape; w: number; h: number }[] = [
  { label: 'Stage', shape: 'rect', w: 44, h: 12 },
  { label: 'Dance floor', shape: 'rect', w: 32, h: 22 },
  { label: 'Bar', shape: 'soft', w: 28, h: 8 },
  { label: 'Buffet', shape: 'soft', w: 24, h: 8 },
  { label: 'Entrance', shape: 'round', w: 14, h: 9 },
  { label: 'Area', shape: 'rect', w: 24, h: 14 },
];

type Selection = { kind: 'table' | 'item'; id: string } | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Where each chair sits, as a percentage of the table's own box. */
function chairPoints(table: SeatTable): { left: number; top: number }[] {
  const { seats, shape } = table;
  if (shape === 'long') {
    const top = Math.ceil(seats / 2);
    const bottom = seats - top;
    return Array.from({ length: seats }, (_, index) =>
      index < top
        ? { left: ((index + 1) / (top + 1)) * 100, top: -6 }
        : { left: ((index + 1 - top) / (bottom + 1)) * 100, top: 106 },
    );
  }
  return Array.from({ length: seats }, (_, index) => {
    const angle = ((-90 + (360 / seats) * index) * Math.PI) / 180;
    return { left: 50 + 53 * Math.cos(angle), top: 50 + 53 * Math.sin(angle) };
  });
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && !/^[&+]?$/.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export default function SeatingPlanEditor({ inv }: { inv: Invitation }) {
  const byId = useMemo(() => new Map(inv.guests.map((guest) => [guest.id, guest])), [inv.guests]);
  const [plan, setPlan] = useState<SeatingPlan>(() => resolveSeating(inv.seating, byId));
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [selected, setSelected] = useState<Selection>(
    inv.seating?.tables[0] ? { kind: 'table', id: inv.seating.tables[0].id } : null,
  );
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropChair, setDropChair] = useState<{ tableId: string; chair: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [seatMode, setSeatMode] = useState<SeatMode>('balanced');
  const [copied, setCopied] = useState(false);
  const floorRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<{
    kind: 'table' | 'item';
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const mounted = useRef(false);

  const items = plan.items ?? [];
  const attending = useMemo(() => inv.guests.filter((guest) => guest.status === 'yes'), [inv.guests]);
  const seated = useMemo(() => seatedGuestIds(plan), [plan]);
  const unseated = attending.filter((guest) => !seated.has(guest.id));
  const totalSeats = plan.tables.reduce((sum, table) => sum + table.seats, 0);
  const totalHeads = attending.reduce((sum, guest) => sum + partySize(guest), 0);
  const selectedTable = selected?.kind === 'table' ? plan.tables.find((t) => t.id === selected.id) ?? null : null;
  const selectedItem = selected?.kind === 'item' ? items.find((item) => item.id === selected.id) ?? null : null;
  const drift = useMemo(() => seatingDrift(plan, inv.guests), [plan, inv.guests]);
  const replied = inv.guests.filter((guest) => guest.status !== 'invited').length;
  const awaiting = inv.guests.length - replied;

  // One next step at a time: guests, tables, replies, chairs, drift, final.
  const guidance = useMemo(() => {
    if (!inv.guests.length) {
      return {
        tone: 'info',
        text: 'No guests yet. Add them on the host page — their replies appear here, and you can seat people as they come in.',
      };
    }
    if (!plan.tables.length) {
      return {
        tone: 'info',
        text: 'Add a table to begin. Every chair is numbered, so you can drop each party on the exact seat you want.',
      };
    }
    if (awaiting > 0) {
      return plan.finalized
        ? {
            tone: 'done',
            text: `The plan is final, so seated guests can see their table. ${awaiting} ${awaiting === 1 ? 'guest has' : 'guests have'} not replied yet — seat them when they do, and their table appears on their invitation.`,
          }
        : {
            tone: 'wait',
            text: `${awaiting} of ${inv.guests.length} guests ${awaiting === 1 ? 'has' : 'have'} not replied yet. You can start seating now — the plan saves as you go — then reseat once the last replies arrive.`,
          };
    }
    if (unseated.length) {
      return {
        tone: 'act',
        text: `Every guest has replied. ${unseated.length} attending ${unseated.length === 1 ? 'guest still needs' : 'guests still need'} a chair — “Seat everyone” fills them in, or drag each party onto a chair.`,
      };
    }
    if (drift.length) {
      return {
        tone: 'act',
        text: 'Everyone is seated, but some parties changed size after you placed them. Reseat them, then mark the plan final.',
      };
    }
    if (!plan.finalized) {
      return {
        tone: 'ready',
        text: 'Everyone who replied has a chair. Mark the plan final when you are happy — guests will then see their table and chair on the invitation.',
      };
    }
    return {
      tone: 'done',
      text: 'The plan is final. Each guest sees their table and chair on their invitation; while you keep arranging, seats stay hidden.',
    };
  }, [plan.tables.length, plan.finalized, inv.guests, awaiting, unseated.length, drift.length]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/invitations/${inv.id}/seating`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tables: plan.tables,
            items,
            snapshot: plan.snapshot ?? {},
            finalized: Boolean(plan.finalized),
          }),
        });
        setStatus(res.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [plan, items, inv.id]);

  const update = useCallback((mutate: (tables: SeatTable[]) => SeatTable[]) => {
    setPlan((prev) => ({ ...prev, tables: mutate(prev.tables) }));
  }, []);

  const updateItems = useCallback((mutate: (current: VenueItem[]) => VenueItem[]) => {
    setPlan((prev) => ({ ...prev, items: mutate(prev.items ?? []) }));
  }, []);

  function addTable() {
    const table = newTable(plan.tables.length);
    update((tables) => [...tables, table]);
    setSelected({ kind: 'table', id: table.id });
  }

  function addItem(preset: (typeof VENUE_PRESETS)[number]) {
    const item = newVenueItem(items.length, preset);
    updateItems((current) => [...current, item]);
    setSelected({ kind: 'item', id: item.id });
  }

  function seatAt(guestId: string, tableId: string | null, chair = 0) {
    const guest = byId.get(guestId);
    const size = guest ? partySize(guest) : 1;
    const placed = placeGuest(plan, guestId, tableId, chair, size);
    const landed = placed.tables.some((table) => table.chairs.includes(guestId));
    // Remember the size they held, so a later +1 can be spotted as drift.
    const next = landed ? markSeated(placed, guestId, size) : markUnseated(placed, guestId);
    setPlan(next);
    setNote(
      tableId && !landed
        ? `That table has no ${size === 1 ? 'free chair' : `run of ${size} free chairs`} there. Try another chair or add seats.`
        : null,
    );
  }

  function fillTables() {
    setPlan((prev) => autoSeat(prev.tables, attending, seatMode));
    setNote(null);
  }

  function reseatChanged() {
    const next = reseatDrifted(plan, inv.guests);
    setPlan(next);
    const stranded = seatingDrift(next, inv.guests).filter(
      (entry) => !next.tables.some((table) => table.chairs.includes(entry.guest.id)),
    );
    setNote(
      stranded.length
        ? `${stranded.length} ${stranded.length === 1 ? 'party no longer fits' : 'parties no longer fit'} at their table — they are back at the rail.`
        : null,
    );
  }

  function beginMove(
    e: React.PointerEvent<HTMLElement>,
    kind: 'table' | 'item',
    id: string,
    x: number,
    y: number,
  ) {
    if ((e.target as HTMLElement).closest('button, select, input, a')) return;
    const floor = floorRef.current?.getBoundingClientRect();
    if (!floor) return;
    e.preventDefault();
    setSelected({ kind, id });
    moveRef.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      x,
      y,
      w: floor.width,
      h: floor.height,
    };
    const move = (ev: globalThis.PointerEvent) => {
      const d = moveRef.current;
      if (!d) return;
      const nx = Math.round(clamp(d.x + ((ev.clientX - d.startX) / d.w) * 100, 6, 94) * 10) / 10;
      const ny = Math.round(clamp(d.y + ((ev.clientY - d.startY) / d.h) * 100, 8, 90) * 10) / 10;
      setPlan((prev) =>
        d.kind === 'table'
          ? {
              ...prev,
              tables: prev.tables.map((table) =>
                table.id === d.id ? { ...table, x: nx, y: ny } : table,
              ),
            }
          : {
              ...prev,
              items: (prev.items ?? []).map((item) =>
                item.id === d.id ? { ...item, x: nx, y: ny } : item,
              ),
            },
      );
    };
    const up = () => {
      moveRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  async function copyPlan() {
    const tables = plan.tables.map((table) => {
      const names = tableParties(table)
        .map((id) => byId.get(id))
        .filter((guest): guest is Guest => Boolean(guest))
        .map((guest) => `${guest.name} (${partySize(guest)})`);
      return `${table.name} — ${tableLoad(table)} of ${table.seats}\n${names.length ? names.map((name) => `  ${name}`).join('\n') : '  empty'}`;
    });
    const venue = items.length ? [`Room: ${items.map((item) => item.label).join(', ')}`] : [];
    const spare = unseated.length ? [`Unseated — ${unseated.map((guest) => guest.name).join(', ')}`] : [];
    try {
      await navigator.clipboard.writeText(
        `${inv.event.title}\n\n${[...tables, ...venue, ...spare].join('\n\n')}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="host-shell seating-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand">
            <BrandMark />
          </Link>
          <span className="crumb">/</span>
          <span className="host-title">{inv.event.title}</span>
          <span className="crumb">·</span>
          <span className="seating-crumb">Seating</span>
        </div>
        <div className="topbar-right">
          <span className={`save-state is-${status}`}>
            {status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Not saved'}
          </span>
          <Link className="btn btn-ghost" href={`/host/${inv.id}`}>
            Guest list
          </Link>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            Print
          </button>
          <Link className="btn btn-primary" href={`/i/${inv.id}`} target="_blank" rel="noreferrer">
            View invitation
          </Link>
        </div>
      </header>

      <main className="seating-main">
        <section className="seating-floor-wrap">
          <div className="seating-head">
            <div>
              <h1 className="host-heading">The room</h1>
              <p className="muted small">
                {plan.tables.length} {plan.tables.length === 1 ? 'table' : 'tables'} · {totalSeats}{' '}
                chairs · {totalHeads} attending
              </p>
            </div>
            <div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={addTable}>
                Add table
              </button>
              <select
                className="input seat-add-item"
                aria-label="Add a venue item"
                value=""
                onChange={(e) => {
                  const preset = VENUE_PRESETS.find((option) => option.label === e.target.value);
                  if (preset) addItem(preset);
                  e.currentTarget.value = '';
                }}
              >
                <option value="">Add venue item…</option>
                {VENUE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <select
                className="input seat-mode"
                aria-label="How to seat everyone"
                title="Balanced tables spreads parties evenly; Groups together keeps families and friend groups at one table"
                value={seatMode}
                onChange={(e) => setSeatMode(e.target.value as SeatMode)}
              >
                <option value="balanced">Balanced tables</option>
                <option value="grouped">Groups together</option>
              </select>
              <button
                className="btn btn-ghost btn-small"
                onClick={fillTables}
                disabled={!plan.tables.length || !attending.length}
              >
                Seat everyone
              </button>
              <button className="btn btn-ghost btn-small" onClick={copyPlan} disabled={!plan.tables.length}>
                {copied ? 'Copied' : 'Copy plan'}
              </button>
            </div>
          </div>

          {note ? <p className="seating-alert">{note}</p> : null}

          {drift.length ? (
            <div className="seating-drift" role="status">
              <p>
                {drift.length === 1 ? 'One party has' : `${drift.length} parties have`} changed since you
                seated them —{' '}
                {drift
                  .slice(0, 3)
                  .map((entry) => `${entry.guest.name} (${entry.held}→${entry.now})`)
                  .join(', ')}
                .
              </p>
              <button className="btn btn-ghost btn-small" onClick={reseatChanged}>
                Reseat them
              </button>
            </div>
          ) : null}

          <div className={`seating-tip is-${guidance.tone}`} role="note">
            <p>{guidance.text}</p>
          </div>

          <div className={`seating-final${plan.finalized ? ' is-on' : ''}`}>
            <div>
              <strong>{plan.finalized ? 'Seating is final' : 'Seats hidden from guests'}</strong>
              <p className="muted small">
                {plan.finalized
                  ? 'Guests see their table and chair on the invitation.'
                  : 'Guests see no table on the invitation until you mark the plan final.'}
              </p>
            </div>
            <button
              className="btn btn-ghost btn-small"
              onClick={() => setPlan((prev) => ({ ...prev, finalized: !prev.finalized }))}
              disabled={!plan.tables.length}
            >
              {plan.finalized ? 'Stop showing seating' : 'Mark seating final'}
            </button>
          </div>

          <div className="seating-floor" ref={floorRef} onClick={() => setSelected(null)}>
            {plan.tables.length === 0 && items.length === 0 ? (
              <div className="seating-empty">
                <h2>An empty room</h2>
                <p>
                  Add tables and venue items — a stage, a bar, the dance floor — then drag a party onto
                  a chair. Every chair is numbered, so people sit exactly where you want them.
                </p>
                <button className="btn btn-primary" onClick={addTable}>
                  Add the first table
                </button>
              </div>
            ) : null}

            {items.map((item) => (
              <div
                key={item.id}
                className={`venue-item${selected?.kind === 'item' && selected.id === item.id ? ' is-selected' : ''}`}
                data-shape={item.shape}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                }}
                onPointerDown={(e) => beginMove(e, 'item', item.id, item.x, item.y)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected({ kind: 'item', id: item.id });
                }}
              >
                <span>{item.label}</span>
              </div>
            ))}

            {plan.tables.map((table) => {
              const load = tableLoad(table);
              return (
                <div
                  key={table.id}
                  className={[
                    'seat-table',
                    `is-${table.shape}`,
                    selected?.kind === 'table' && selected.id === table.id ? 'is-selected' : '',
                    dropChair?.tableId === table.id ? 'is-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    transform: `translate(-50%, -50%) rotate(${table.rotation ?? 0}deg)`,
                  }}
                  onPointerDown={(e) => beginMove(e, 'table', table.id, table.x, table.y)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected({ kind: 'table', id: table.id });
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const guestId = e.dataTransfer.getData('text/plain');
                    if (guestId) seatAt(guestId, table.id, 0);
                    setDropChair(null);
                    setDragged(null);
                  }}
                >
                  <span className="seat-table-name">{table.name}</span>
                  <span className="seat-table-load">
                    {load}
                    <span className="seat-table-of"> / {table.seats}</span>
                  </span>
                  <span className="seat-table-parties">
                    {tableParties(table)
                      .map((id) => byId.get(id)?.name)
                      .filter(Boolean)
                      .join(', ') || 'Every chair free'}
                  </span>

                  {table.chairs.map((occupantId, index) => {
                    const guest = occupantId ? byId.get(occupantId) : null;
                    const previous =
                      table.chairs[(index - 1 + table.chairs.length) % table.chairs.length];
                    const continued = Boolean(occupantId) && previous === occupantId;
                    const point = chairPoints(table)[index];
                    const held = index >= usableSeats(table);
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={held}
                        className={[
                          'seat-chair',
                          occupantId ? 'is-taken' : '',
                          continued ? 'is-continued' : '',
                          held ? 'is-spare' : '',
                          dropChair?.tableId === table.id && dropChair.chair === index ? 'is-over' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ left: `${point.left}%`, top: `${point.top}%` }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (occupantId) seatAt(occupantId, null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropChair({ tableId: table.id, chair: index });
                        }}
                        onDragLeave={() => setDropChair(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const guestId = e.dataTransfer.getData('text/plain');
                          if (guestId) seatAt(guestId, table.id, index);
                          setDropChair(null);
                          setDragged(null);
                        }}
                        aria-label={`${table.name}, chair ${index + 1}${
                          held ? ', held spare' : guest ? `, ${guest.name}` : ', empty'
                        }`}
                        title={
                          held
                            ? 'Held spare for a late plus-one'
                            : guest
                              ? `${guest.name} — chair ${index + 1}. Click to lift out of the chair.`
                              : `Chair ${index + 1} — empty`
                        }
                      >
                        {occupantId ? (continued ? '·' : initials(guest?.name ?? '')) : held ? '–' : index + 1}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="seating-rail">
          <section className="rail-block">
            <h2 className="rail-title">Parties</h2>
            <p className="panel-note">
              Drag a party onto a chair, or pick a table from its menu to take the first free chairs.
              Only guests who said yes are listed.
            </p>

            {attending.length === 0 ? (
              <p className="muted small">No one has accepted yet.</p>
            ) : (
              <ul className="seat-party-list">
                {attending.map((guest) => {
                  const table = plan.tables.find((option) => option.chairs.includes(guest.id));
                  return (
                    <li
                      key={guest.id}
                      className={`seat-party${dragged === guest.id ? ' is-dragging' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', guest.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragged(guest.id);
                      }}
                      onDragEnd={() => setDragged(null)}
                    >
                      <span className="seat-party-name">{guest.name}</span>
                      <span className="seat-party-size">
                        {partySize(guest)} {partySize(guest) === 1 ? 'chair' : 'chairs'}
                      </span>
                      <select
                        className="input seat-party-select"
                        aria-label={`Table for ${guest.name}`}
                        value={table?.id ?? ''}
                        onChange={(e) => seatAt(guest.id, e.target.value || null, 0)}
                      >
                        <option value="">Unseated</option>
                        {plan.tables.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            )}

            {unseated.length ? (
              <p className="seating-note">
                {unseated.length} {unseated.length === 1 ? 'party' : 'parties'} still without a chair.
              </p>
            ) : null}
          </section>

          {selectedTable ? (
            <section className="rail-block">
              <h2 className="rail-title">{selectedTable.name}</h2>
              <label className="field">
                <span className="field-label">Name</span>
                <input
                  className="input"
                  value={selectedTable.name}
                  onChange={(e) =>
                    update((tables) =>
                      tables.map((table) =>
                        table.id === selectedTable.id ? { ...table, name: e.target.value } : table,
                      ),
                    )
                  }
                />
              </label>
              <div className="field">
                <span className="field-label">Shape</span>
                <div className="seg">
                  {SHAPES.map((shape) => (
                    <button
                      key={shape.id}
                      className={selectedTable.shape === shape.id ? 'is-on' : ''}
                      onClick={() =>
                        update((tables) =>
                          tables.map((table) =>
                            table.id === selectedTable.id ? { ...table, shape: shape.id } : table,
                          ),
                        )
                      }
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="range-field">
                <span className="range-head">
                  <span className="field-label">Chairs</span>
                  <span className="range-value">{selectedTable.seats}</span>
                </span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={selectedTable.seats}
                  onChange={(e) =>
                    setPlan((prev) => resizeTable(prev, selectedTable.id, Number(e.target.value)))
                  }
                />
              </label>
              <label className="range-field">
                <span className="range-head">
                  <span className="field-label">Rotation</span>
                  <span className="range-value">{selectedTable.rotation ?? 0}°</span>
                </span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selectedTable.rotation ?? 0}
                  onChange={(e) =>
                    update((tables) =>
                      tables.map((table) =>
                        table.id === selectedTable.id
                          ? { ...table, rotation: Number(e.target.value) }
                          : table,
                      ),
                    )
                  }
                />
              </label>
              <label className="range-field">
                <span className="range-head">
                  <span className="field-label">Held spare</span>
                  <span className="range-value">{selectedTable.spare ?? 0}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={selectedTable.spare ?? 0}
                  onChange={(e) =>
                    update((tables) =>
                      tables.map((table) =>
                        table.id === selectedTable.id
                          ? { ...table, spare: Number(e.target.value) }
                          : table,
                      ),
                    )
                  }
                />
              </label>
              <div className="row-actions">
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    setPlan((prev) => removeTable(prev, selectedTable.id));
                    setSelected(null);
                  }}
                >
                  Remove table
                </button>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() =>
                    update((tables) =>
                      tables.map((table) => ({ ...table, chairs: table.chairs.map(() => null) })),
                    )
                  }
                >
                  Clear every seat
                </button>
              </div>
            </section>
          ) : null}

          {selectedItem ? (
            <section className="rail-block">
              <h2 className="rail-title">Venue item</h2>
              <label className="field">
                <span className="field-label">Label</span>
                <input
                  className="input"
                  value={selectedItem.label}
                  onChange={(e) =>
                    updateItems((current) =>
                      current.map((item) =>
                        item.id === selectedItem.id ? { ...item, label: e.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <div className="field">
                <span className="field-label">Shape</span>
                <div className="seg">
                  {VENUE_SHAPES.map((shape) => (
                    <button
                      key={shape.id}
                      className={selectedItem.shape === shape.id ? 'is-on' : ''}
                      onClick={() =>
                        updateItems((current) =>
                          current.map((item) =>
                            item.id === selectedItem.id ? { ...item, shape: shape.id } : item,
                          ),
                        )
                      }
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="range-field">
                <span className="range-head">
                  <span className="field-label">Width</span>
                  <span className="range-value">{Math.round(selectedItem.w)}%</span>
                </span>
                <input
                  type="range"
                  min={6}
                  max={96}
                  step={1}
                  value={selectedItem.w}
                  onChange={(e) =>
                    updateItems((current) =>
                      current.map((item) =>
                        item.id === selectedItem.id ? { ...item, w: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="range-field">
                <span className="range-head">
                  <span className="field-label">Depth</span>
                  <span className="range-value">{Math.round(selectedItem.h)}%</span>
                </span>
                <input
                  type="range"
                  min={4}
                  max={60}
                  step={1}
                  value={selectedItem.h}
                  onChange={(e) =>
                    updateItems((current) =>
                      current.map((item) =>
                        item.id === selectedItem.id ? { ...item, h: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="range-field">
                <span className="range-head">
                  <span className="field-label">Rotation</span>
                  <span className="range-value">{selectedItem.rotation}°</span>
                </span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selectedItem.rotation}
                  onChange={(e) =>
                    updateItems((current) =>
                      current.map((item) =>
                        item.id === selectedItem.id
                          ? { ...item, rotation: Number(e.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="btn btn-ghost btn-small"
                onClick={() => {
                  updateItems((current) => current.filter((item) => item.id !== selectedItem.id));
                  setSelected(null);
                }}
              >
                Remove item
              </button>
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

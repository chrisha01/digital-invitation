import { newId } from './defaults';
import type { Guest, SeatShape, SeatTable, SeatingPlan, VenueItem, VenueShape } from './types';

/** How many chairs a party occupies: the largest of its counts. */
export function partySize(guest: Guest): number {
  return Math.max(1, guest.adults + guest.children, 1 + guest.plusOnes);
}

export const MIN_SEATS = 2;
export const MAX_SEATS = 20;
export const MAX_SPARE = 2;

export function clampSeats(value: number): number {
  const seats = Math.round(Number(value) || 8);
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, seats));
}

export function clampSpare(value: unknown): number {
  const spare = Math.round(Number(value) || 0);
  return Math.min(MAX_SPARE, Math.max(0, spare));
}

/** Chairs that can be given to guests; the spare ones at the end are held back. */
export function usableSeats(table: SeatTable): number {
  const spare = Math.min(clampSpare(table.spare), table.chairs.length - 1);
  return Math.max(1, table.chairs.length - spare);
}

export function emptySeating(): SeatingPlan {
  return { tables: [] };
}

type LegacyTable = SeatTable & { guestIds?: string[] };

/**
 * Chairs are the source of truth. Plans drawn before chairs existed listed
 * party ids per table, so those are spread across the chairs in order.
 */
export function normaliseTable(input: LegacyTable, guests?: Map<string, Guest>): SeatTable {
  const seats = clampSeats(input.seats);
  const source = Array.isArray(input.chairs) ? input.chairs : [];
  const chairs: (string | null)[] = Array.from({ length: seats }, (_, index) =>
    typeof source[index] === 'string' ? (source[index] as string) : null,
  );

  if (!Array.isArray(input.chairs) && input.guestIds?.length) {
    let cursor = 0;
    for (const id of input.guestIds) {
      const guest = guests?.get(id);
      const size = guest ? partySize(guest) : 1;
      for (let taken = 0; taken < size && cursor < seats; taken += 1, cursor += 1) {
        chairs[cursor] = id;
      }
    }
  }

  return {
    id: input.id,
    name: input.name,
    shape: input.shape,
    seats,
    x: input.x,
    y: input.y,
    chairs,
    rotation: normaliseDegrees(input.rotation),
    spare: clampSpare(input.spare),
  };
}

export function normaliseDegrees(value: unknown): number {
  const degrees = Number(value) || 0;
  const wrapped = (((degrees + 180) % 360) + 360) % 360 - 180;
  return Math.round(wrapped);
}

const VENUE_SHAPES: VenueShape[] = ['rect', 'round', 'soft'];

export function normaliseItem(input: VenueItem): VenueItem {
  return {
    id: input.id,
    label: input.label,
    shape: VENUE_SHAPES.includes(input.shape) ? input.shape : 'rect',
    w: Math.min(96, Math.max(6, Number(input.w) || 24)),
    h: Math.min(60, Math.max(4, Number(input.h) || 14)),
    x: Math.min(96, Math.max(4, Number(input.x) || 50)),
    y: Math.min(94, Math.max(6, Number(input.y) || 50)),
    rotation: normaliseDegrees(input.rotation),
  };
}

export function resolveSeating(plan: SeatingPlan | undefined, guests?: Map<string, Guest>): SeatingPlan {
  if (!plan) return emptySeating();
  return {
    ...plan,
    tables: (plan.tables ?? []).map((table) =>
      normaliseTable({ ...(table as LegacyTable), rotation: normaliseDegrees(table.rotation) }, guests),
    ),
    items: (plan.items ?? []).map(normaliseItem),
    snapshot: plan.snapshot ?? {},
  };
}

export function tableLoad(table: SeatTable): number {
  return table.chairs.filter(Boolean).length;
}

export function seatedGuestIds(plan: SeatingPlan): Set<string> {
  return new Set(plan.tables.flatMap((table) => table.chairs.filter((id): id is string => Boolean(id))));
}

/** Names sitting at a table, in chair order, each party once. */
export function tableParties(table: SeatTable): string[] {
  return [...new Set(table.chairs.filter((id): id is string => Boolean(id)))];
}

/** The first block of `size` free chairs at or after `from`, within `limit`. */
export function findChairRun(
  chairs: (string | null)[],
  size: number,
  from = 0,
  limit = chairs.length,
): number | null {
  const usable = Math.min(limit, chairs.length);
  if (size > usable) return null;
  const start = Math.min(Math.max(0, from), usable - 1);
  for (let offset = 0; offset <= usable - size; offset += 1) {
    const begin = (start + offset) % usable;
    let fits = true;
    for (let step = 0; step < size; step += 1) {
      if (chairs[(begin + step) % chairs.length]) {
        fits = false;
        break;
      }
    }
    if (fits) return begin;
  }
  return null;
}

/** Remembers the party size a guest held when they were seated. */
export function markSeated(plan: SeatingPlan, guestId: string, size: number): SeatingPlan {
  return { ...plan, snapshot: { ...(plan.snapshot ?? {}), [guestId]: size } };
}

export function markUnseated(plan: SeatingPlan, guestId: string): SeatingPlan {
  if (!plan.snapshot || !(guestId in plan.snapshot)) return plan;
  const snapshot = { ...plan.snapshot };
  delete snapshot[guestId];
  return { ...plan, snapshot };
}

/**
 * Seats a party at the chair they were dropped on, taking the chairs after it.
 * If that block is taken, the next free block around the table is used.
 */
export function placeGuest(
  plan: SeatingPlan,
  guestId: string,
  tableId: string | null,
  chairIndex = 0,
  size = 1,
): SeatingPlan {
  const cleared = plan.tables.map((table) => ({
    ...table,
    chairs: table.chairs.map((id) => (id === guestId ? null : id)),
  }));

  if (!tableId) return { ...plan, tables: cleared };

  return {
    ...plan,
    tables: cleared.map((table) => {
      if (table.id !== tableId) return table;
      const chairs = [...table.chairs];
      const limit = usableSeats(table);
      const start = findChairRun(chairs, size, chairIndex, limit);
      if (start === null) return table;
      for (let step = 0; step < size; step += 1) {
        chairs[(start + step) % chairs.length] = guestId;
      }
      return { ...table, chairs };
    }),
  };
}

export function removeTable(plan: SeatingPlan, tableId: string): SeatingPlan {
  return { ...plan, tables: plan.tables.filter((table) => table.id !== tableId) };
}

/** Grows or shrinks a table, unseating anyone whose chair is removed. */
export function resizeTable(plan: SeatingPlan, tableId: string, seats: number): SeatingPlan {
  const size = clampSeats(seats);
  return {
    ...plan,
    tables: plan.tables.map((table) =>
      table.id === tableId
        ? {
            ...table,
            seats: size,
            chairs: Array.from({ length: size }, (_, index) => table.chairs[index] ?? null),
          }
        : table,
    ),
  };
}

export function findSeat(plan: SeatingPlan | undefined, guestId: string): { table: SeatTable; chair: number } | null {
  for (const table of plan?.tables ?? []) {
    const chair = table.chairs?.findIndex((id) => id === guestId) ?? -1;
    if (chair >= 0) return { table, chair: chair + 1 };
  }
  return null;
}

export function newTable(index: number, shape: SeatShape = 'round'): SeatTable {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    id: newId('table'),
    name: `Table ${index + 1}`,
    shape,
    seats: 8,
    x: 16 + column * 22,
    y: 22 + row * 30,
    chairs: Array.from({ length: 8 }, () => null),
    rotation: 0,
    spare: 0,
  };
}

export function newVenueItem(
  index: number,
  preset: { label: string; shape: VenueShape; w: number; h: number },
): VenueItem {
  const offset = (index % 5) * 4;
  return {
    id: newId('venue'),
    label: preset.label,
    shape: preset.shape,
    w: preset.w,
    h: preset.h,
    x: Math.min(86, 34 + offset),
    y: Math.min(72, 76 - offset),
    rotation: 0,
  };
}

/** Two ways to fill a room; both keep a party and its companions in one block. */
export type SeatMode = 'balanced' | 'grouped';

type SeatUnit = { host: Guest; members: Guest[]; size: number; tag: string };

/**
 * A guest plus the companions their invitation brought. Seating a unit means
 * everyone it contains shares a table, in adjacent chairs.
 */
function attendeeUnits(attending: Guest[]): SeatUnit[] {
  const ids = new Set(attending.map((guest) => guest.id));
  const hosts = attending.filter((guest) => !guest.companionOf || !ids.has(guest.companionOf));

  return hosts.map((host) => {
    const members = [host, ...attending.filter((guest) => guest.companionOf === host.id)];
    return {
      host,
      members,
      size: members.reduce((sum, member) => sum + partySize(member), 0),
      tag: (host.tag ?? '').trim(),
    };
  });
}

function placeUnit(table: SeatTable, start: number, unit: SeatUnit, snapshot: Record<string, number>) {
  let cursor = start;
  for (const member of unit.members) {
    const size = partySize(member);
    for (let step = 0; step < size; step += 1) {
      table.chairs[cursor + step] = member.id;
    }
    cursor += size;
    snapshot[member.id] = size;
  }
}

type Candidate = { table: SeatTable; index: number; start: number; load: number };

function candidatesFor(seated: SeatTable[], size: number): Candidate[] {
  return seated
    .map((table, index) => ({
      table,
      index,
      start: findChairRun(table.chairs, size, 0, usableSeats(table)),
      load: tableLoad(table),
    }))
    .filter((candidate): candidate is Candidate => candidate.start !== null);
}

/**
 * Spreads parties so tables fill at a similar rate: the room's chairs are
 * divided by the number of tables and no table is pushed far past its share
 * before the next one is used.
 */
function seatBalanced(seated: SeatTable[], units: SeatUnit[], snapshot: Record<string, number>) {
  const total = units.reduce((sum, unit) => sum + unit.size, 0);
  const tableCount = Math.max(1, seated.filter((table) => usableSeats(table) > 0).length);
  const share = Math.max(1, Math.ceil(total / tableCount));
  const ordered = [...units].sort((a, b) => b.size - a.size || a.host.name.localeCompare(b.host.name));

  for (const unit of ordered) {
    const fits = candidatesFor(seated, unit.size);
    if (!fits.length) continue;
    // Prefer tables still inside their share, but a large party may exceed it.
    const within = fits.filter((candidate) => candidate.load + unit.size <= Math.max(share, unit.size));
    const pool = within.length ? within : fits;
    pool.sort((a, b) => a.load - b.load || a.index - b.index);
    placeUnit(pool[0].table, pool[0].start, unit, snapshot);
  }
}

/**
 * Groups first: a tag's parties share a table until it can hold no more, then
 * continue at the emptiest table that fits. Keeps families and friend groups
 * at one table instead of scattering them for the sake of even numbers.
 */
function seatGrouped(seated: SeatTable[], units: SeatUnit[], snapshot: Record<string, number>) {
  const groups = new Map<string, SeatUnit[]>();
  for (const unit of units) {
    const key = unit.tag || 'Guests';
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }

  const ordered = [...groups.entries()].sort((a, b) => {
    const sizeA = a[1].reduce((sum, unit) => sum + unit.size, 0);
    const sizeB = b[1].reduce((sum, unit) => sum + unit.size, 0);
    return sizeB - sizeA || a[0].localeCompare(b[0]);
  });

  const tagsAt = new Map(seated.map((table) => [table.id, new Set<string>()]));

  for (const [tag, group] of ordered) {
    const queue = [...group].sort((a, b) => b.size - a.size || a.host.name.localeCompare(b.host.name));
    for (const unit of queue) {
      const fits = candidatesFor(seated, unit.size);
      if (!fits.length) continue;
      fits.sort((a, b) => {
        const aHere = tagsAt.get(a.table.id)?.has(tag) ? 0 : 1;
        const bHere = tagsAt.get(b.table.id)?.has(tag) ? 0 : 1;
        return aHere - bHere || a.load - b.load || a.index - b.index;
      });
      const pick = fits[0];
      placeUnit(pick.table, pick.start, unit, snapshot);
      tagsAt.get(pick.table.id)?.add(tag);
    }
  }
}

/**
 * Fills the room. Anyone who fits nowhere is left at the rail, and every
 * placed party's size is recorded so a later +1 shows up as drift.
 */
export function autoSeat(
  tables: SeatTable[],
  attending: Guest[],
  mode: SeatMode = 'balanced',
): SeatingPlan {
  const seated = tables.map((table) => ({
    ...table,
    chairs: table.chairs.map(() => null as string | null),
  }));
  const snapshot: Record<string, number> = {};
  const units = attendeeUnits(attending);

  if (mode === 'grouped') seatGrouped(seated, units, snapshot);
  else seatBalanced(seated, units, snapshot);

  return { tables: seated, snapshot, updatedAt: new Date().toISOString() };
}

export type SeatDrift = { guest: Guest; held: number; now: number };

/** Parties whose numbers changed since they were seated. */
export function seatingDrift(plan: SeatingPlan, guests: Guest[]): SeatDrift[] {
  const snapshot = plan.snapshot ?? {};
  const seen = new Set<string>();
  const drift: SeatDrift[] = [];

  for (const table of plan.tables) {
    for (const id of table.chairs) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const held = snapshot[id];
      if (typeof held !== 'number') continue;
      const guest = guests.find((candidate) => candidate.id === id);
      if (!guest) continue;
      const now = partySize(guest);
      if (now !== held) drift.push({ guest, held, now });
    }
  }

  return drift;
}

/**
 * Re-seats the parties whose size changed, leaving everyone else exactly where
 * they were: each one keeps their table if it still fits, else takes the
 * tightest table that does.
 */
export function reseatDrifted(plan: SeatingPlan, guests: Guest[]): SeatingPlan {
  let next = plan;
  for (const { guest, now } of seatingDrift(plan, guests)) {
    next = {
      ...next,
      tables: next.tables.map((table) => ({
        ...table,
        chairs: table.chairs.map((id) => (id === guest.id ? null : id)),
      })),
    };

    let best: { table: SeatTable; start: number; spare: number } | null = null;
    for (const table of next.tables) {
      const start = findChairRun(table.chairs, now, 0, usableSeats(table));
      if (start === null) continue;
      const spare = tableLoad(table) + now - usableSeats(table);
      if (!best || spare < best.spare) best = { table, start, spare };
    }

    if (!best) {
      next = markUnseated(next, guest.id);
      continue;
    }

    next = {
      ...next,
      tables: next.tables.map((table) => {
        if (table.id !== best!.table.id) return table;
        const chairs = [...table.chairs];
        for (let step = 0; step < now; step += 1) {
          chairs[(best!.start + step) % chairs.length] = guest.id;
        }
        return { ...table, chairs };
      }),
    };
    next = markSeated(next, guest.id, now);
  }
  return next;
}

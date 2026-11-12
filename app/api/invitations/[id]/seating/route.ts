import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { getInvitation, mutateInvitation } from '@/lib/store';
import { clampSeats, clampSpare, normaliseDegrees, normaliseItem } from '@/lib/seating';
import type { SeatShape, SeatTable, VenueItem, VenueShape } from '@/lib/types';

const SHAPES: SeatShape[] = ['round', 'long', 'square'];
const VENUE_SHAPES: VenueShape[] = ['rect', 'round', 'soft'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function cleanTables(input: unknown): SeatTable[] | null {
  if (!Array.isArray(input)) return null;
  const tables: SeatTable[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const table = raw as Record<string, unknown>;
    if (typeof table.id !== 'string' || !table.id || seen.has(table.id)) return null;
    seen.add(table.id);

    const shape = SHAPES.includes(table.shape as SeatShape) ? (table.shape as SeatShape) : 'round';
    const seats = clampSeats(Number(table.seats));

    const taken: (string | null)[] = Array.isArray(table.chairs)
      ? table.chairs.slice(0, seats).map((id) => (typeof id === 'string' && id ? id : null))
      : [];
    const chairs = Array.from({ length: seats }, (_, index) => taken[index] ?? null);

    tables.push({
      id: table.id,
      name: typeof table.name === 'string' ? table.name.slice(0, 60) || 'Table' : 'Table',
      shape,
      seats,
      x: clamp(Number(table.x), 4, 96),
      y: clamp(Number(table.y), 6, 94),
      chairs,
      rotation: normaliseDegrees(table.rotation),
      spare: clampSpare(table.spare),
    });
  }

  return tables;
}

function cleanItems(input: unknown): VenueItem[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input)) return null;
  const items: VenueItem[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) return null;
    seen.add(item.id);

    items.push(
      normaliseItem({
        id: item.id,
        label: typeof item.label === 'string' ? item.label.slice(0, 40) || 'Area' : 'Area',
        shape: VENUE_SHAPES.includes(item.shape as VenueShape)
          ? (item.shape as VenueShape)
          : 'rect',
        w: clamp(Number(item.w), 6, 96),
        h: clamp(Number(item.h), 4, 60),
        x: clamp(Number(item.x), 4, 96),
        y: clamp(Number(item.y), 6, 94),
        rotation: normaliseDegrees(item.rotation),
      }),
    );
  }

  return items;
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const owned = user ? await getInvitation(id) : null;
  if (!owned || !canManage(owned, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | { tables?: unknown; items?: unknown; snapshot?: unknown; finalized?: unknown }
    | null;
  const tables = cleanTables(body?.tables);
  const items = cleanItems(body?.items);
  if (!tables || !items) return NextResponse.json({ error: 'Invalid seating plan' }, { status: 400 });

  const snapshot: Record<string, number> = {};
  if (body?.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot)) {
    for (const [guestId, size] of Object.entries(body.snapshot as Record<string, unknown>)) {
      const parsed = Number(size);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 40) snapshot[guestId] = Math.round(parsed);
    }
  }

  const updated = await mutateInvitation(id, (invitation) => {
    invitation.seating = {
      tables,
      items,
      snapshot,
      finalized: body?.finalized === true,
      updatedAt: new Date().toISOString(),
    };
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ seating: updated.seating });
}

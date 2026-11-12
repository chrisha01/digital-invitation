import { defaultBackdrop, defaultCard, defaultEnvelope, getDesign, type Design } from './designs';
import type { Invitation, TextLayer } from './types';

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

function layer(partial: Partial<TextLayer> & { name: string; text: string }): TextLayer {
  return {
    id: newId('layer'),
    font: '"Jost", "Helvetica Neue", Arial, sans-serif',
    size: 3,
    color: '#2c2620',
    weight: 400,
    italic: false,
    uppercase: false,
    tracking: 0,
    lineHeight: 1.35,
    align: 'center',
    x: 10,
    y: 20,
    width: 80,
    visible: true,
    ...partial,
  };
}

/** Ten days before the event, to the minute, for the RSVP deadline. */
function deadlineBefore(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '2027-09-01T23:59';
  date.setDate(date.getDate() - 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T23:59`;
}

export function sampleLayers(design: Design): TextLayer[] {
  const ink = design.card.ink;
  const s = design.sample;
  return [
    layer({
      name: 'Eyebrow',
      text: s?.eyebrow ?? 'Please join us',
      font: design.body,
      size: 2.3,
      color: ink,
      uppercase: true,
      tracking: 0.32,
      y: 12.5,
    }),
    layer({
      name: 'Hosts',
      text: s?.hosts ?? 'Amelia & Jonah',
      font: design.heading,
      size: 8.4,
      color: ink,
      lineHeight: 1.06,
      y: 23.5,
    }),
    layer({
      name: 'Occasion',
      text: s?.occasion ?? 'for a late-summer supper',
      font: design.body,
      size: 3.1,
      color: ink,
      italic: true,
      y: 36,
    }),
    layer({
      name: 'Date',
      text: s?.date ?? 'Saturday, the eleventh of September',
      font: design.body,
      size: 2.9,
      color: ink,
      uppercase: true,
      tracking: 0.14,
      y: 50,
    }),
    layer({
      name: 'Time',
      text: s?.time ?? "Seven o'clock in the evening",
      font: design.body,
      size: 2.9,
      color: ink,
      y: 56,
    }),
    layer({
      name: 'Venue',
      text: s?.venue ?? 'The Old Fig House',
      font: design.heading,
      size: 5,
      color: ink,
      y: 68,
    }),
    layer({
      name: 'Address',
      text: s?.address ?? '14 Marlow Lane · Hudson, New York',
      font: design.body,
      size: 2.4,
      color: ink,
      y: 76,
    }),
    layer({
      name: 'Note',
      text: s?.note ?? 'Dinner, drinks & dancing to follow',
      font: design.body,
      size: 2.3,
      color: ink,
      italic: true,
      y: 86,
    }),
  ];
}

export function buildInvitation(designSlug?: string): Invitation {
  const design = getDesign(designSlug ?? 'gilded-arch');
  return {
    id: newId('inv'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    designSlug: design.slug,
    title: design.sample?.title ?? 'Late-summer supper',
    subject: design.sample?.subject ?? "You're invited: a late-summer supper",
    card: {
      ...defaultCard(design),
      layers: sampleLayers(design),
    },
    envelope: defaultEnvelope(design),
    backdrop: defaultBackdrop(design),
    event: {
      title: design.sample?.eventTitle ?? 'A Late-Summer Supper',
      host: design.sample?.host ?? 'Amelia & Jonah',
      startsAt: design.sample?.startsAt ?? '2027-09-11T19:00',
      endsAt: design.sample?.endsAt ?? '2027-09-11T23:00',
      location: design.sample?.venue ?? 'The Old Fig House',
      address: design.sample?.address ?? '14 Marlow Lane, Hudson, NY 12534',
      description:
        design.sample?.description ??
        'A long table under the fig tree — supper, wine, and dancing until the candles burn out. Come as you are.',
      dressCode: design.sample?.dressCode ?? 'Garden formal',
    },
    settings: {
      collectRsvp: true,
      showGuestList: true,
      allowPlusOnes: true,
      maxPlusOnes: 2,
      capacity: null,
      deadline: design.sample ? deadlineBefore(design.sample.startsAt) : '2027-09-01T23:59',
      headcount: true,
      textUpdates: true,
      questions: [
        {
          id: newId('q'),
          label: 'Anything we should know about dietary needs?',
          type: 'text',
          options: [],
          required: false,
        },
      ],
    },
    page: {
      background: design.page.background,
      text: design.page.text,
      accent: design.page.accent,
      fontBody: design.body,
      fontHeading: design.heading,
    },
    blocks: [
      {
        id: newId('block'),
        type: 'schedule',
        title: 'The evening',
        body: '7:00 — Drinks on the terrace\n8:00 — Supper is served\n10:00 — Dancing in the barn',
        url: '',
      },
      {
        id: newId('block'),
        type: 'link',
        title: 'Registry',
        body: 'Your presence is the present, but if you insist.',
        url: 'https://example.com/registry',
      },
    ],
    guests: [],
    seating: { tables: [] },
  };
}

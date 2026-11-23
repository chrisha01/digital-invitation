import { DESIGNS } from './designs';

export type Plan = {
  name: string;
  amount: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

/**
 * The published price list. Illustrative only: nothing here is billed, and
 * nothing in the app reads a plan to decide what an account may do.
 */
export const PLANS: Plan[] = [
  {
    name: 'Note',
    amount: '£0',
    cadence: 'to try it',
    blurb: 'An invitation, from design to replies.',
    features: [
      `All ${DESIGNS.length} designs, every font`,
      'Envelope, liner and stamp',
      'Shared RSVP link',
      'Guest list and reply table',
      'Seating plan',
      'CSV export of the replies',
    ],
    cta: 'Start free',
  },
  {
    name: 'Letter',
    amount: '£24',
    cadence: 'per event',
    blurb: 'For a wedding, or a party with a list.',
    features: [
      'Everything in Note',
      'Plus-ones and household parties',
      'Signed personal link per guest',
      'Email and text reminders',
      'Check-in screen and printed report',
      'Co-hosts by email',
    ],
    cta: 'Start an invitation',
    featured: true,
  },
  {
    name: 'Suite',
    amount: '£79',
    cadence: 'per event',
    blurb: 'Everything, with the room to match.',
    features: [
      'Everything in Letter',
      'Custom questions on the reply',
      'Cover photo, framed portrait, backdrop',
      'Held spare chairs at the table',
      'Every future design, included',
    ],
    cta: 'Start an invitation',
  },
];

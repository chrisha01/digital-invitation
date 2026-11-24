import { DESIGNS } from './designs';
import { PLAN_CAPS, PLAN_LABELS, type PlanKey } from './plan-caps';

export type Plan = {
  key: PlanKey;
  name: string;
  /** Invitations an account on this plan may hold; the server reads the same number. */
  cap: number;
  amount: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

/**
 * The published price list. The prices are illustrative — nothing is charged
 * and there is no checkout — but the capacity each tier names is the capacity
 * the create route enforces (lib/plan-caps.ts).
 */
export const PLANS: Plan[] = [
  {
    key: 'note',
    name: PLAN_LABELS.note,
    cap: PLAN_CAPS.note,
    amount: '£0',
    cadence: 'to try it',
    blurb: 'One invitation, from design to replies.',
    features: [
      '1 invitation at a time',
      `All ${DESIGNS.length} designs, every font`,
      'Envelope, liner and stamp',
      'Shared RSVP link',
      'Guest list, reply table and CSV export',
      'Seating plan',
    ],
    cta: 'Start free',
  },
  {
    key: 'letter',
    name: PLAN_LABELS.letter,
    cap: PLAN_CAPS.letter,
    amount: '£24',
    cadence: 'per account',
    blurb: 'For a wedding, or a party with a list.',
    features: [
      '3 invitations at a time',
      'Everything in Note',
      'Room for the next event before the last is over',
    ],
    cta: 'Start an invitation',
    featured: true,
  },
  {
    key: 'suite',
    name: PLAN_LABELS.suite,
    cap: PLAN_CAPS.suite,
    amount: '£79',
    cadence: 'per account',
    blurb: 'For someone who hosts all year.',
    features: [
      '10 invitations at a time',
      'Everything in Letter',
      'Room for a whole season of events',
    ],
    cta: 'Start an invitation',
  },
];

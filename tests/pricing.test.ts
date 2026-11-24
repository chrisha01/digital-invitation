import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESIGNS } from '@/lib/designs';
import { PLAN_CAPS, PLAN_KEYS, PLAN_PRICES, money } from '@/lib/plan-caps';
import { PLANS } from '@/lib/plans';

/**
 * The price list is copy plus numbers a reader can hold the build to: the
 * invitation cap, and the price the checkout actually charges. These tests keep
 * the copy honest about both, keep the capacity the same in the database and in
 * code, and keep a plan change behind a signature-checked payment.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(`${root}${path}`, 'utf8');

const home = read('app/page.tsx');

/** The `#pricing` section, nav links and footers excluded. */
function pricingSection(source: string): string {
  const start = source.indexOf('<section className="section pricing"');
  const end = source.indexOf('</section>', start);
  if (start < 0 || end < 0) throw new Error('the pricing section moved; update this test with it');
  return source.slice(start, end);
}

const section = pricingSection(home);

/** Every word one card puts in front of a reader. */
const planText = (plan: (typeof PLANS)[number]) =>
  [plan.name, plan.amount, plan.cadence, plan.blurb, plan.cta, ...plan.features].join('\n');

const allPlanText = PLANS.map(planText).join('\n\n');

/** Words that promise a boundary the build does not draw. */
const FALSE_CLAIMS = [
  'unlimited',
  'capped',
  'maximum',
  'per month',
  'per year',
  'per user',
  'only one',
  'one event',
  'single event',
];

/**
 * Features every tier gets. Listing one under a single plan would imply the
 * others cannot have it, which is not true: only capacity is gated.
 */
const UNGATED_FEATURES = [
  'plus-one',
  'reminder',
  'check-in',
  'co-host',
  'custom question',
  'cover photo',
  'portrait',
  'backdrop',
];

describe('the published price list', () => {
  it('publishes three tiers, in pounds, two of them per account', () => {
    expect(PLANS).toHaveLength(3);
    expect(new Set(PLANS.map((plan) => plan.name)).size).toBe(3);
    expect(PLANS.map((plan) => plan.amount)).toEqual(['£0', '£24', '£79']);
    expect(PLANS.filter((plan) => plan.cadence === 'per account')).toHaveLength(2);
    for (const plan of PLANS) {
      expect(plan.blurb).not.toBe('');
      expect(plan.cta).not.toBe('');
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('prints the price the checkout charges', () => {
    // Both come from PLAN_PRICES, so a card cannot advertise a price the server
    // would not charge (or charge one it never printed).
    for (const plan of PLANS) {
      expect(plan.amount, `${plan.name} prints a price the checkout does not charge`).toBe(
        money(PLAN_PRICES[plan.key]),
      );
    }
  });

  it('names the invitation capacity the server enforces, and nothing else', () => {
    for (const plan of PLANS) {
      const text = planText(plan);
      const numbers = [...text.matchAll(/(\d+)\s+invitations?\b/gi)].map((match) => Number(match[1]));
      expect(numbers.length, `${plan.name} never says how many invitations it holds`).toBeGreaterThan(
        0,
      );
      // Retitling a card by hand is allowed; claiming a different cap is not.
      expect(
        new Set(numbers),
        `${plan.name} names a capacity the server does not enforce`,
      ).toEqual(new Set([PLAN_CAPS[plan.key]]));
      expect(plan.cap).toBe(PLAN_CAPS[plan.key]);
    }
  });

  it('promises nothing the build does not do', () => {
    const claimed = FALSE_CLAIMS.filter((claim) =>
      new RegExp(`\\b${claim}\\b`, 'i').test(allPlanText),
    );
    expect(claimed, 'only capacity is gated, so the cards may not claim another limit').toEqual([]);

    const exclusive = UNGATED_FEATURES.filter((feature) =>
      new RegExp(`\\b${feature}s?\\b`, 'i').test(allPlanText),
    );
    expect(
      exclusive,
      'every tier gets these, so listing one under a single plan would imply a gate',
    ).toEqual([]);
  });

  it('names the number of designs that actually ships', () => {
    // The feature string is built from DESIGNS, so the two cannot drift apart.
    const named = allPlanText.match(/\b(\d+) designs\b/i)?.[1];
    expect(named, 'no tier says how many designs ship').toBeDefined();
    expect(Number(named)).toBe(DESIGNS.length);
  });

  it('sends a paid tier to checkout and the free tier to the editor', () => {
    // One link, shared by all three tiers because the section maps over PLANS.
    expect(section).toMatch(/\{PLANS\.map\(/);
    expect(section.match(/<Link/g)?.length).toBe(1);
    // The branch is on the plan key and on being signed in, nothing else.
    expect(section).toMatch(/plan\.key === 'note'/);
    expect(section).toMatch(/'\/create'/);
    expect(section).toMatch(/'\/app\/account'/);
    expect(section).toMatch(/'\/signin\?next=%2Fapp%2Faccount'/);
    // No price is sent from the page; the server prices the session.
    expect(section).not.toMatch(/unit_amount|amount_total/);
  });

  it('says what is charged, how often, and that nothing renews', () => {
    expect(section).toMatch(/caps how many invitations/i);
    expect(section).toMatch(/Stripe Checkout/);
    expect(section).toMatch(/paid once/i);
    expect(section).toMatch(/no subscription/i);
    expect(section).toMatch(/nothing renews/i);
  });
});

describe('the plan gate', () => {
  /** Every file that decides what an account may do or pay. */
  function serverFiles(): string[] {
    const walk = (dir: string): string[] =>
      readdirSync(`${root}${dir}`, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return walk(path);
        return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
      });
    return [
      ...walk('/app/api'),
      '/lib/access.ts',
      '/lib/store.ts',
      '/lib/plan-caps.ts',
      '/lib/purchases.ts',
    ];
  }

  it('checks the cap where an invitation is created', () => {
    const create = read('/app/api/invitations/route.ts');
    expect(create).toMatch(/putInvitationWithinCap\(/);
    expect(create).toMatch(/planKey\(user\.plan\)/);
    expect(create).toMatch(/planCap\(plan\)/);
    // A bare write would skip the cap; creation goes through the checked one.
    expect(create).not.toMatch(/await putInvitation\(/);
  });

  it('keeps the caps positive, increasing and distinct', () => {
    expect([...PLAN_KEYS]).toEqual(['note', 'letter', 'suite']);
    expect(Object.keys(PLAN_CAPS).sort()).toEqual([...PLAN_KEYS].sort());

    const caps = PLAN_KEYS.map((key) => PLAN_CAPS[key]);
    for (const cap of caps) {
      expect(Number.isInteger(cap)).toBe(true);
      expect(cap).toBeGreaterThan(0);
    }
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
    expect(new Set(caps).size).toBe(caps.length);
  });

  it('prices the free plan at nothing and the paid plans above it', () => {
    expect(PLAN_PRICES.note).toBe(0);
    expect(PLAN_PRICES.letter).toBeGreaterThan(0);
    expect(PLAN_PRICES.suite).toBeGreaterThan(PLAN_PRICES.letter);
    for (const key of PLAN_KEYS) expect(Number.isInteger(PLAN_PRICES[key])).toBe(true);
  });

  it('keeps the database enum in step with the caps', () => {
    const migration = read('/db/migrations/0004_plans.sql');
    expect(migration).toMatch(/add column if not exists plan text/i);
    expect(migration).toMatch(/set default 'note'/i);
    expect(migration).toMatch(/set not null/i);

    const listed = migration
      .match(/check\s*\(\s*plan\s+in\s*\(([^)]*)\)/i)?.[1]
      ?.match(/'([^']+)'/g)
      ?.map((value) => value.slice(1, -1))
      .sort();
    expect(
      listed,
      'the users_plan_check constraint and PLAN_CAPS must list the same plans',
    ).toEqual([...PLAN_KEYS].sort());
  });

  it('keeps an idempotent receipt for every payment', () => {
    const migration = read('/db/migrations/0005_purchases.sql');
    expect(migration).toMatch(/session_id\s+text not null unique/i);
    expect(migration).toMatch(/user_id\s+text not null references users\(id\)/i);
    expect(migration).toMatch(/amount\s+integer not null check \(amount > 0\)/i);
  });

  it('shows the plan and the count on the account page', () => {
    const account = read('/app/app/account/page.tsx');
    expect(account).toMatch(/plan-badge/);
    expect(account).toMatch(/PLAN_LABELS\[plan\]/);
    expect(account).toMatch(/planCap\(plan\)/);
    // The offered upgrades are the plans above this one, decided server-side.
    expect(account).toMatch(/paidPlansAbove\(plan\)/);
  });

  it('charges its own price and only sells a higher plan', () => {
    const checkout = read('/app/api/checkout/route.ts');
    // The amount comes from the price table, never from the request body.
    expect(checkout).toMatch(/PLAN_PRICES\[plan\]/);
    expect(checkout).toMatch(/paidPlansAbove\(user\.plan\)/);
    expect(checkout).not.toMatch(/body\?\.(amount|price)/);
  });

  it('verifies the stripe signature before it parses a webhook', () => {
    const webhook = read('/app/api/stripe/webhook/route.ts');
    const verifyAt = webhook.indexOf('verifyStripeSignature');
    const parseAt = webhook.indexOf('JSON.parse');
    expect(verifyAt, 'the webhook never verifies its signature').toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(parseAt);
    expect(webhook).toMatch(/STRIPE_WEBHOOK_SECRET/);
  });

  it('lets only the webhook raise a plan', () => {
    const recorders = serverFiles().filter((path) => /await recordPurchase\(/.test(read(path)));
    expect(recorders, 'a plan may only change on a recorded payment').toEqual([
      '/app/api/stripe/webhook/route.ts',
    ]);

    const writers = serverFiles().filter((path) => /set plan = \$2/i.test(read(path)));
    expect(writers, 'the purchased-plan path is the only one that sets a plan').toEqual([
      '/lib/purchases.ts',
    ]);
  });
});

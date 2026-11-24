import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESIGNS } from '@/lib/designs';
import { PLAN_CAPS, PLAN_KEYS } from '@/lib/plan-caps';
import { PLANS } from '@/lib/plans';

/**
 * The price list is copy plus one number a reader can hold the build to: the
 * invitation cap. These tests keep the copy honest about that cap, keep the
 * capacity the same in the database and in code, and keep payment out of the
 * build — a plan is granted by hand, so there is nothing to buy.
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

  it('sends every tier to the same place, where nothing is charged', () => {
    // One link, shared by all three tiers because the section maps over PLANS.
    expect(section).toMatch(/\{PLANS\.map\(/);
    expect(section.match(/href="\/create"/g)?.length).toBe(1);
    expect(section).not.toMatch(/checkout|billing|stripe|upgrade|pricing\.com/i);
  });

  it('says how plans are granted and that nothing is charged', () => {
    expect(section).toMatch(/caps how many invitations/i);
    expect(section).toMatch(/plans\s+are granted by hand/i);
    expect(section).toMatch(/nothing is charged/i);
    expect(section).toMatch(/starts on Note/i);
    expect(section).toMatch(/differ in how many invitations/i);
  });
});

describe('the plan gate', () => {
  /** Every file that decides what an account may do. */
  function serverFiles(): string[] {
    const walk = (dir: string): string[] =>
      readdirSync(`${root}${dir}`, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return walk(path);
        return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
      });
    return [...walk('/app/api'), '/lib/access.ts', '/lib/store.ts', '/lib/plan-caps.ts'];
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

  it('shows the plan and the count on the account page', () => {
    const account = read('/app/app/account/page.tsx');
    expect(account).toMatch(/plan-badge/);
    expect(account).toMatch(/PLAN_LABELS\[plan\]/);
    expect(account).toMatch(/planCap\(plan\)/);
  });

  it('has no payment provider behind the badge', () => {
    const paid = serverFiles().filter((path) =>
      /\b(stripe|checkout|billing|subscription|paypal)\b/i.test(read(path)),
    );
    expect(paid, 'a plan is granted by hand; nothing may charge for one').toEqual([]);
  });
});

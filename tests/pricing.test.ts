import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESIGNS } from '@/lib/designs';

/**
 * The price list is copy, not code: nothing in the app reads it, and nothing in
 * the app gates a plan. These tests hold it to that — every claim here is either
 * true of the build or removed, and adding a paywall breaks the second block.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(`${root}${path}`, 'utf8');

const home = read('app/page.tsx');

/** The three tiers, from `const PLANS` to its closing `];`. */
function plansBlock(source: string): string {
  const start = source.indexOf('const PLANS');
  const end = source.indexOf('\n];', start);
  if (start < 0 || end < 0) throw new Error('the price list moved; update this test with it');
  return source.slice(start, end);
}

/** The `#pricing` section, nav links and footers excluded. */
function pricingSection(source: string): string {
  const start = source.indexOf('<section className="section pricing"');
  const end = source.indexOf('</section>', start);
  if (start < 0 || end < 0) throw new Error('the pricing section moved; update this test with it');
  return source.slice(start, end);
}

const plans = plansBlock(home);
const section = pricingSection(home);

/** Words that promise a boundary the app never draws. */
const LIMIT_CLAIMS = [
  'unlimited',
  'up to',
  'maximum',
  'limit',
  'only one',
  'one event',
  'single event',
  'capped',
  'per month',
  'per year',
  'per user',
];

describe('the published price list', () => {
  it('publishes three tiers, in pounds, priced per event', () => {
    // The cards are one `.map()` over PLANS, so the tiers are counted in the data.
    expect(plans.match(/^    name: '/gm)?.length).toBe(3);
    expect(plans.match(/^    features: \[/gm)?.length).toBe(3);
    for (const amount of ["£0", "£24", "£79"]) expect(plans).toContain(`amount: '${amount}'`);
    expect(plans.match(/cadence: 'per event'/g)?.length).toBe(2);
  });

  it('promises no limit the build does not enforce', () => {
    const claimed = LIMIT_CLAIMS.filter((claim) => new RegExp(`\\b${claim}\\b`, 'i').test(plans));
    expect(claimed, 'the app caps nothing, so the price list must not say it does').toEqual([]);
  });

  it('names the number of designs that actually ships', () => {
    // Derived from DESIGNS, so a new design cannot leave a stale count behind.
    expect(plans).toContain('${DESIGNS.length} designs');
    // And no hard-coded count, which is how it went stale before.
    expect(plans).not.toMatch(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten|twelve) designs\b/i);
    expect(DESIGNS.length).toBeGreaterThan(0);
  });

  it('sends every tier to the same place, where nothing is charged', () => {
    // One link, shared by all three tiers because they share the map.
    expect(section.match(/href="\/create"/g)?.length).toBe(1);
    expect(section).not.toMatch(/checkout|billing|stripe|upgrade|pricing\.com/i);
  });

  it('says plainly that it is a price list, not a gate', () => {
    expect(section).toMatch(/no payment/i);
    expect(section).toMatch(/enforces no plan/i);
  });
});

describe('no plan gate in the server', () => {
  /** Every file that decides what an account may do. */
  function serverFiles(): string[] {
    const walk = (dir: string): string[] =>
      readdirSync(`${root}${dir}`, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return walk(path);
        return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
      });
    return [...walk('/app/api'), '/lib/access.ts', '/lib/store.ts'];
  }

  it('never asks which plan an account is on', () => {
    const gated = serverFiles().filter((path) =>
      /\b(planTier|planId|plan_id|planLimit|entitlement|entitlements|premium|paywall|subscription|stripe|billing|checkout)\b/i.test(
        read(path),
      ),
    );
    // If this fails, a paywall was added: the price list's "no plan" note and
    // this test have to change with it, not be deleted quietly.
    expect(gated, 'these files gate a plan, but the price list says nothing is gated').toEqual([]);
  });

  it('asks only for a signed-in account before making an invitation', () => {
    const create = read('/app/api/invitations/route.ts');
    expect(create).toMatch(/currentUser\(\)/);
  });
});

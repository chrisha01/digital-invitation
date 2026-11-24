'use client';

import { useState } from 'react';
import { PLAN_CAPS, PLAN_LABELS, PLAN_PRICES, money, type PlanKey } from '@/lib/plan-caps';

/**
 * The paid plans above the account's own. The server decides which ones are on
 * offer; this only asks it for a Checkout Session and follows the URL Stripe
 * returns, so card details never pass through this app.
 */
export default function PlanUpgrade({ plans }: { plans: PlanKey[] }) {
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(plan: PlanKey) {
    if (busy) return;
    setBusy(plan);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) throw new Error(body?.error ?? 'Checkout could not start.');
      window.location.assign(body.url);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Checkout could not start.');
      setBusy(null);
    }
  }

  return (
    <div className="m-upgrade">
      <ul className="m-plan-options">
        {plans.map((plan) => (
          <li key={plan} className="m-plan-option">
            <span className="m-plan-copy">
              <span className="m-plan-name">{PLAN_LABELS[plan]} plan</span>
              <span className="m-meta">
                {PLAN_CAPS[plan]} invitations at a time · paid once
              </span>
            </span>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => void buy(plan)}
              disabled={busy !== null}
            >
              {busy === plan ? 'Opening…' : `Pay ${money(PLAN_PRICES[plan])}`}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

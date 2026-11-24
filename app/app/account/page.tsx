import Link from 'next/link';
import PlanUpgrade from '@/components/app/PlanUpgrade';
import SignOutButton from '@/components/SignOutButton';
import { forgetUser, getUserById, requireUser } from '@/lib/auth';
import { checkoutConfigured } from '@/lib/billing';
import { confirmCheckoutReturn } from '@/lib/checkout-return';
import { PLAN_LABELS, paidPlansAbove, planCap, planKey } from '@/lib/plan-caps';
import { listInvitations } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string; session_id?: string }>;
}) {
  let user = await requireUser('/app/account');
  const saved = await listInvitations(user.id);
  const { paid, cancelled, session_id: sessionId } = await searchParams;

  // Back from Checkout: record the payment now through the same idempotent path
  // the webhook uses, then read the plan again past the short-lived user cache,
  // so this page cannot keep showing the plan and the offer that were just paid
  // for while the webhook is still on its way.
  if (paid) {
    await confirmCheckoutReturn(sessionId, user.id);
    forgetUser(user.id);
    user = (await getUserById(user.id)) ?? user;
  }

  const plan = planKey(user.plan);
  const cap = planCap(plan);
  const atCap = saved.length >= cap;
  const upgrades = paidPlansAbove(plan);
  const checkoutReady = checkoutConfigured();

  return (
    <main className="m-page">
      <header className="m-head">
        <h1 className="m-title">Account</h1>
      </header>

      {paid ? (
        <div className="m-panel">
          <h2>Payment received</h2>
          {plan === 'note' ? (
            <p>
              Stripe has the payment. Your plan shows up here as soon as the confirmation lands,
              usually within a few seconds — reload to see it.
            </p>
          ) : (
            <p>
              Thank you. This account is on the {PLAN_LABELS[plan]} plan, which holds {cap}{' '}
              {cap === 1 ? 'invitation' : 'invitations'} at a time. Nothing renews and there is
              nothing else to pay.
            </p>
          )}
        </div>
      ) : null}

      {cancelled ? (
        <div className="m-panel">
          <h2>Checkout closed</h2>
          <p>Nothing was charged and your plan has not changed.</p>
        </div>
      ) : null}

      <div className="m-panel">
        <p className="plan-badge">{PLAN_LABELS[plan]} plan</p>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <p className="m-meta">
          {saved.length} of {cap} {cap === 1 ? 'invitation' : 'invitations'} used
        </p>
        {atCap ? (
          <p>
            That is everything this plan holds. Delete an invitation to start another, or{' '}
            <Link href="/#pricing">see what a larger plan holds</Link>.
          </p>
        ) : null}
        {saved.length === 0 ? (
          <p className="filter-empty">
            No invitations yet. Start one from a design and it will show up in your list.
          </p>
        ) : null}
      </div>

      {upgrades.length ? (
        <div className="m-panel">
          <h2>More invitations</h2>
          <p>
            A plan is paid once for this account and does not renew. {PLAN_LABELS[plan]} holds {cap}{' '}
            {cap === 1 ? 'invitation' : 'invitations'} at a time.
          </p>
          {checkoutReady ? (
            <PlanUpgrade plans={upgrades} />
          ) : (
            <p className="m-meta">
              Checkout is not switched on for this build yet, so a larger plan is granted by hand.
            </p>
          )}
        </div>
      ) : null}

      <div className="m-panel">
        <h2>Sign out</h2>
        <p>You will need to sign in again to see your invitations.</p>
        <SignOutButton next="/app" />
      </div>
    </main>
  );
}

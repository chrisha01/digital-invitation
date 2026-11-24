import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteInvitationButton from '@/components/DeleteInvitationButton';
import InvitationCard from '@/components/InvitationCard';
import { canManage, isOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { formatWhen } from '@/lib/dates';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  yes: { label: 'Attending', tone: 'is-yes' },
  no: { label: 'Declined', tone: 'is-no' },
  maybe: { label: 'Maybe', tone: 'is-maybe' },
  invited: { label: 'Invited', tone: 'is-invited' },
};

export default async function AppInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, inv] = await Promise.all([
    requireUser(`/app/i/${id}`),
    getInvitation(id),
  ]);
  if (!inv || !canManage(inv, user)) notFound();
  // Co-hosts can edit, but only the owner may delete the invitation itself.
  const owner = isOwner(inv, user);

  const guests = inv.guests ?? [];
  const attending = guests.filter((guest) => guest.status === 'yes').length;
  const checkedIn = guests.filter((guest) => guest.checkedInAt).length;

  return (
    <main className="m-page">
      <Link href="/app" className="m-back">
        ‹ Invitations
      </Link>

      <header className="m-head">
        <p className="m-eyebrow">{formatWhen(inv.event.startsAt)}</p>
        <h1 className="m-title">{inv.title || inv.event.title}</h1>
        <p className="m-sub">{[inv.event.location, inv.event.host].filter(Boolean).join(' · ')}</p>
      </header>

      <div className="m-preview">
        <InvitationCard inv={inv} />
      </div>

      <div className="m-stats">
        <div className="m-stat">
          <span>{guests.length}</span>
          <small>Invited</small>
        </div>
        <div className="m-stat">
          <span>{attending}</span>
          <small>Attending</small>
        </div>
        <div className="m-stat">
          <span>{checkedIn}</span>
          <small>Checked in</small>
        </div>
      </div>

      <section className="m-panel m-actions">
        <h2>Tools</h2>
        <Link className="btn btn-primary" href={`/app/i/${inv.id}/edit`}>
          Edit the card
        </Link>
        <Link className="btn btn-ghost" href={`/app/i/${inv.id}/guests`}>
          Guests &amp; check-in
        </Link>
        <Link className="btn btn-ghost" href={`/app/i/${inv.id}/seating`}>
          Seating plan
        </Link>
        <Link className="btn btn-ghost" href={`/app/i/${inv.id}/guest`}>
          Guest page
        </Link>
        {owner ? (
          <DeleteInvitationButton
            id={inv.id}
            title={inv.title || inv.event.title}
            redirectTo="/app"
            label="Delete invitation"
          />
        ) : null}
      </section>

      <section className="m-group">
        <h2 className="m-group-title">Guest list · {guests.length}</h2>
        {guests.length === 0 ? (
          <div className="m-empty">
            <h2>No guests yet</h2>
            <p>Guests added to this invitation will appear here.</p>
          </div>
        ) : (
          <ul className="m-guests">
            {guests.map((guest) => {
              const status = STATUS_LABEL[guest.status] ?? STATUS_LABEL.invited;
              return (
                <li key={guest.id}>
                  <span className="m-guest-name">
                    {guest.name}
                    {guest.household ? <small>{guest.household}</small> : null}
                  </span>
                  <span className={`m-pill ${status.tone}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

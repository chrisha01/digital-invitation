import BrandMark from '@/components/BrandMark';

// A guest who opened a dead link has no host tools to come back to, so this
// speaks to them rather than offering to start an invitation of their own.
export default function GuestInvitationNotFound() {
  return (
    <main className="guest-lost">
      <div className="guest-lost-card">
        <span className="brand guest-lost-brand">
          <BrandMark />
        </span>
        <p className="guest-lost-eyebrow">Invitation not found</p>
        <h1>This invitation isn’t available.</h1>
        <p className="guest-lost-copy">
          The link may be incomplete, or the invitation may have been withdrawn since it was sent.
          Nothing you did caused it.
        </p>
        <p className="guest-lost-hint">
          Ask whoever invited you for a fresh link — the host can resend it from their invitation.
        </p>
      </div>
      <p className="guest-lost-footer">Sent with Gatherly</p>
    </main>
  );
}

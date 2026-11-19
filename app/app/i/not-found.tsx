import AppTabs from '@/components/app/AppTabs';
import NotFoundPanel from '@/components/app/NotFoundPanel';

// These paths hide the tab bar on real invitation pages, so ask for it here.
export default function InvitationNotFound() {
  return (
    <div className="m-notfound">
      <NotFoundPanel
        title="This invitation isn’t here"
        reason="The link may be out of date, or the invitation was deleted."
        note="Your other invitations are still waiting for you."
      />
      <AppTabs always />
    </div>
  );
}

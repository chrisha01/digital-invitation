import AppTabs from '@/components/app/AppTabs';
import AppPanel from '@/components/app/AppPanel';

// These paths hide the tab bar on real invitation pages, so ask for it here.
export default function InvitationNotFound() {
  return (
    <div className="m-notfound">
      <AppPanel
        title="This invitation isn’t here"
        reason="The link may be out of date, or the invitation was deleted."
        panelTitle="Nothing to open"
        note="Your other invitations are still waiting for you."
      />
      <AppTabs always />
    </div>
  );
}

import AppPanel from '@/components/app/AppPanel';
import TabsWhenHidden from '@/components/app/TabsWhenHidden';

export default function AppNotFound() {
  return (
    <div className="m-notfound">
      <AppPanel
        title="This page isn’t here"
        reason="The link may be out of date, or the page has moved."
        panelTitle="Nothing to open"
        note="Your invitations are still waiting for you."
      />
      <TabsWhenHidden />
    </div>
  );
}

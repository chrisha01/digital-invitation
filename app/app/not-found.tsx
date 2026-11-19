import NotFoundPanel from '@/components/app/NotFoundPanel';
import TabsWhenHidden from '@/components/app/TabsWhenHidden';

export default function AppNotFound() {
  return (
    <div className="m-notfound">
      <NotFoundPanel
        title="This page isn’t here"
        reason="The link may be out of date, or the page has moved."
        note="Your invitations are still waiting for you."
      />
      <TabsWhenHidden />
    </div>
  );
}

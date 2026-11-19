import Link from 'next/link';
import HostPanel from '@/components/host/HostPanel';

export default function CreateNotFound() {
  return (
    <HostPanel
      label="Not found"
      title="This invitation isn’t here"
      body="This editing link is out of date, or the invitation behind it has been deleted. Saved invitations still open from your invitations list."
    >
      <Link className="btn btn-primary" href="/app">
        Back to your invitations
      </Link>
      <Link className="btn btn-ghost" href="/app/create">
        Start a new invitation
      </Link>
    </HostPanel>
  );
}

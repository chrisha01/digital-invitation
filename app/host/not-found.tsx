import Link from 'next/link';
import HostPanel from '@/components/host/HostPanel';

export default function HostNotFound() {
  return (
    <HostPanel
      label="Not found"
      title="This invitation isn’t here"
      body="It may have been deleted, or it may belong to a different account. If someone shared the dashboard with you, sign in with the account they invited."
    >
      <Link className="btn btn-primary" href="/app">
        Back to your invitations
      </Link>
    </HostPanel>
  );
}

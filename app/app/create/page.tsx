import Link from 'next/link';
import StartInvitation from '@/components/app/StartInvitation';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppCreatePage() {
  await requireUser('/app/create');

  return (
    <main className="m-page">
      <header className="m-head">
        <h1 className="m-title">Start an invitation</h1>
        <p className="m-sub">Pick a design to start the card, then make it yours.</p>
      </header>

      <div className="m-panel">
        <h2>Choose a design</h2>
        <p>Cards, envelopes and stamps in eight moods. Start from one and restyle it later.</p>
        <Link className="btn btn-ghost" href="/app/designs">
          Browse designs
        </Link>
      </div>

      <div className="m-panel">
        <h2>Blank card</h2>
        <p>Start from the house default. Nothing is locked in.</p>
        <StartInvitation className="btn btn-primary" busyLabel="Starting…">
          Start blank
        </StartInvitation>
      </div>

      <p className="m-note">
        Type, colours, portrait and envelope lining are set in the full card editor.
      </p>
    </main>
  );
}

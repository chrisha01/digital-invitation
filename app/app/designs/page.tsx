import InvitationCard from '@/components/InvitationCard';
import StartInvitation from '@/components/app/StartInvitation';
import { DESIGNS } from '@/lib/designs';
import { buildInvitation } from '@/lib/defaults';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppDesignsPage() {
  await requireUser('/app/designs');
  const categories = [...new Set(DESIGNS.map((design) => design.category))];

  return (
    <main className="m-page">
      <header className="m-head">
        <h1 className="m-title">Designs</h1>
        <p className="m-sub">Pick a starting point. Words stay yours; the rest is restyled.</p>
      </header>

      {categories.map((category) => (
        <section key={category} className="m-group">
          <h2 className="m-group-title">{category}</h2>
          <div className="m-designs">
            {DESIGNS.filter((design) => design.category === category).map((design) => (
              <StartInvitation
                key={design.slug}
                design={design.slug}
                className="m-design"
                busyLabel="Starting…"
              >
                <>
                  <span className="m-design-card" aria-hidden>
                    <InvitationCard inv={buildInvitation(design.slug)} />
                  </span>
                  <span className="m-design-name">{design.name}</span>
                </>
              </StartInvitation>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

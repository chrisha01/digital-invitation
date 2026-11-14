import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import DeleteInvitationButton from '@/components/DeleteInvitationButton';
import SignOutButton from '@/components/SignOutButton';
import { currentUser } from '@/lib/auth';
import EnvelopeCard from '@/components/EnvelopeCard';
import InvitationCard from '@/components/InvitationCard';
import { buildInvitation } from '@/lib/defaults';
import { DESIGNS } from '@/lib/designs';
import { listInvitations, listSharedInvitations } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string; events?: string }>;
}) {
  const { category, page: pageParam, events } = await searchParams;
  const user = await currentUser();
  // Both lists are independent; fetching them together saves a full database
  // round trip on every visit to the home page.
  const [saved, shared] = user
    ? await Promise.all([listInvitations(user.id), listSharedInvitations(user.email)])
    : [[], []];
  // The hero still life is the product's own artwork, so it can never go stale.
  // Held still: drifting confetti behind the headline reads as noise.
  const hero = buildInvitation('gilded-arch');
  const heroCard = { ...hero, card: { ...hero.card, drift: null } };

  const now = Date.now();
  const eventFilter = events === 'upcoming' || events === 'past' ? events : 'all';
  const eventTime = (value: string) => {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  // Nearest event first, then the archive newest-first.
  const orderedSaved = [...saved].sort((a, b) => {
    const aUp = eventTime(a.startsAt) >= now;
    const bUp = eventTime(b.startsAt) >= now;
    if (aUp !== bUp) return aUp ? -1 : 1;
    return aUp
      ? eventTime(a.startsAt) - eventTime(b.startsAt)
      : eventTime(b.startsAt) - eventTime(a.startsAt);
  });
  const shownSaved = orderedSaved.filter((item) =>
    eventFilter === 'all'
      ? true
      : eventFilter === 'upcoming'
        ? eventTime(item.startsAt) >= now
        : eventTime(item.startsAt) < now,
  );
  const editionTotals = {
    events: saved.length,
    guests: saved.reduce((sum, item) => sum + item.headcount, 0),
    replies: saved.reduce((sum, item) => sum + item.yesCount + item.maybeCount, 0),
    here: saved.reduce((sum, item) => sum + item.checkedIn, 0),
  };

  const categories = [...new Set(DESIGNS.map((design) => design.category))];
  const active = category && categories.includes(category) ? category : null;

  // Filter designs by active category (or all if none selected)
  const filteredDESIGNS = active
    ? DESIGNS.filter((design) => design.category === active)
    : DESIGNS;

  // Pagination: 8 designs per page
  const designsPerPage = 8;
  const totalPages = Math.ceil(filteredDESIGNS.length / designsPerPage);
  const page = parseInt(pageParam ?? '') || 1;
  const activePage = Math.min(Math.max(page, 1), totalPages);
  const start = (activePage - 1) * designsPerPage;
  const end = start + designsPerPage;
  const pageDESIGNS = filteredDESIGNS.slice(start, end);
  const shown = pageDESIGNS;

  return (
    <div className="home">
      <header className="home-nav">
        <span className="brand">
          <BrandMark />
        </span>
        <nav className="home-links">
          <a href="#designs">Designs</a>
          <a href="#how">How it works</a>
          {saved.length ? <a href="#yours">Your invitations</a> : null}
          {user ? (
            <>
              <span className="muted small">{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link className="btn btn-ghost btn-small" href="/signin">
              Sign in
            </Link>
          )}
          <Link className="btn btn-primary" href="/create">
            Start an invitation
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">Online invitations, properly dressed</p>
          <h1>
            Invitations that arrive
            <br />
            like post.
          </h1>
          <p className="hero-sub">
            Choose a card, set the type, line the envelope and stamp it. Guests get an envelope with
            their own name on the front, a card that opens, and one page with everything they need —
            plus RSVPs you can actually read.
          </p>
          <p className="hero-sub-accent">
            <span>Plan your seating</span> · <span>Track RSVPs</span> · <span>Send reminders</span>
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-large" href="/create">
              Create an invitation
            </Link>
            <a className="btn btn-ghost btn-large" href="#designs">
              Browse the designs
            </a>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-envelope">
            <EnvelopeCard
              envelope={hero.envelope}
              designSlug={hero.designSlug}
              guestName="Amelia & Jonah"
            />
          </div>
          <div className="hero-art-card">
            <InvitationCard inv={heroCard} />
          </div>
        </div>
      </section>

      {saved.length > 0 ? (
        <section className="section" id="yours">
          <div className="section-head">
            <h2>Your events</h2>
            <span className="muted small">
              {editionTotals.events} invitation{editionTotals.events === 1 ? '' : 's'} ·{' '}
              {editionTotals.guests} heads expected · {editionTotals.replies} replies ·{' '}
              {editionTotals.here} checked in
            </span>
          </div>

          <nav className="cat-nav event-filters" aria-label="Event filters">
            <Link
              className={eventFilter === 'all' ? 'cat-chip is-on' : 'cat-chip'}
              href="/#yours"
              scroll={false}
            >
              All
            </Link>
            <Link
              className={eventFilter === 'upcoming' ? 'cat-chip is-on' : 'cat-chip'}
              href="/?events=upcoming#yours"
              scroll={false}
            >
              Upcoming
            </Link>
            <Link
              className={eventFilter === 'past' ? 'cat-chip is-on' : 'cat-chip'}
              href="/?events=past#yours"
              scroll={false}
            >
              Past
            </Link>
          </nav>

          <div className="event-grid">
            {shownSaved.map((item) => {
              const start = new Date(item.startsAt);
              const valid = !Number.isNaN(start.getTime());
              const upcoming = eventTime(item.startsAt) >= now;
              const replied = item.yesCount + item.maybeCount;
              const replyPct = item.guestCount
                ? Math.round((replied / item.guestCount) * 100)
                : 0;
              return (
                <article className="event-card" key={item.id}>
                  <div className="event-date">
                    <span className="event-day">{valid ? start.getDate() : '—'}</span>
                    <span className="event-month">
                      {valid ? start.toLocaleDateString(undefined, { month: 'short' }) : 'No date'}
                    </span>
                  </div>
                  <div className="event-body">
                    <div className="event-title-row">
                      <strong>{item.title}</strong>
                      <span className={`event-pill ${upcoming ? 'is-upcoming' : 'is-past'}`}>
                        {upcoming ? 'Upcoming' : 'Past'}
                      </span>
                    </div>
                    <p className="muted small">
                      {valid
                        ? start.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'No date set'}
                      {item.location ? ` · ${item.location}` : ''}
                    </p>
                    <p className="muted small event-counts">
                      {item.yesCount} attending · {item.headcount} heads · {item.checkedIn} checked in
                      · {item.guestCount} invited
                    </p>
                    <div
                      className="event-meter"
                      aria-label={`${replyPct}% of guests replied`}
                      title={`${replyPct}% of guests replied`}
                    >
                      <span style={{ width: `${replyPct}%` }} />
                    </div>
                    <p className="muted small">{replyPct}% replied</p>
                    <div className="row-actions">
                      <Link className="btn btn-ghost btn-small" href={`/host/${item.id}`}>
                        Dashboard
                      </Link>
                      <Link className="btn btn-ghost btn-small" href={`/host/${item.id}/checkin`}>
                        Check-in
                      </Link>
                      <Link className="btn btn-ghost btn-small" href={`/create?id=${item.id}`}>
                        Edit
                      </Link>
                      <Link
                        className="btn btn-ghost btn-small"
                        href={`/i/${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </Link>
                      <DeleteInvitationButton id={item.id} title={item.title} />
                    </div>
                  </div>
                </article>
              );
            })}
            {!shownSaved.length ? (
              <p className="muted">No {eventFilter} events yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {shared.length > 0 ? (
        <section className="section" id="shared">
          <div className="section-head">
            <h2>Shared with you</h2>
            <span className="muted small">Invitations where you are a co-host</span>
          </div>
          <div className="saved-grid">
            {shared.map((item) => (
              <div className="saved-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted small">
                    {item.preview || 'Untitled'} · {item.guestCount} guests · {item.yesCount} attending
                  </p>
                </div>
                <div className="row-actions">
                  <Link className="btn btn-ghost btn-small" href={`/host/${item.id}`}>
                    Open
                  </Link>
                  <Link
                    className="btn btn-ghost btn-small"
                    href={`/i/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" id="designs">
        <div className="section-head">
          <h2>Start from a design</h2>
          <span className="muted small">
            {active
              ? `${filteredDESIGNS.length} in ${active}`
              : `${DESIGNS.length} originals, endlessly adjustable`}
          </span>
        </div>

        <nav className="cat-nav" aria-label="Design categories">
          <Link className={active ? 'cat-chip is-on' : 'cat-chip'} href="/#designs" scroll={false}>
            All
          </Link>
          {categories.map((name) => (
            <Link
              key={name}
              className={active === name ? 'cat-chip is-on' : 'cat-chip'}
              href={`/?category=${encodeURIComponent(name)}#designs`}
              scroll={false}
            >
              {name}
            </Link>
          ))}
        </nav>

        {totalPages > 1 ? (
          <nav className="pagination" aria-label="Design pages">
            {activePage > 1 ? (
              <Link
                className="pagination-btn"
                href={`/?${active ? `category=${encodeURIComponent(active)}&` : ''}page=${activePage - 1}#designs`}
                scroll={false}
              >
                ← Previous
              </Link>
            ) : null}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <Link
                key={pageNum}
                className={`pagination-btn${activePage === pageNum ? ' is-on' : ''}`}
                href={`/?${active ? `category=${encodeURIComponent(active)}&` : ''}page=${pageNum}#designs`}
                scroll={false}
                aria-current={activePage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </Link>
            ))}
            {activePage < totalPages ? (
              <Link
                className="pagination-btn"
                href={`/?${active ? `category=${encodeURIComponent(active)}&` : ''}page=${activePage + 1}#designs`}
                scroll={false}
              >
                Next →
              </Link>
            ) : null}
            <span className="pagination-info">
              Page {activePage} of {totalPages}
            </span>
          </nav>
        ) : null}

        <div className="gallery">
          {shown.map((design) => {
            const preview = buildInvitation(design.slug);
            return (
              <Link
                key={design.slug}
                className="gallery-item"
                href={`/create?design=${design.slug}`}
                aria-label={`Start with ${design.name}`}
              >
                <div className="gallery-card">
                  <InvitationCard inv={preview} />
                </div>
                <div className="gallery-meta">
                  <span className="gallery-tag">{design.category}</span>
                  <strong>{design.name}</strong>
                  <span className="muted small">{design.blurb}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section how" id="how">
        <h2>Three minutes, start to send</h2>
        <div className="how-grid">
          <div>
            <span className="step-no">01</span>
            <h3>Design the card</h3>
            <p>
              Move the words anywhere, swap fonts, set your own hex colours, add a photo, artwork and
              a border.
            </p>
          </div>
          <div>
            <span className="step-no">02</span>
            <h3>Dress the envelope</h3>
            <p>
              Choose the paper, the liner pattern and the stamp. Each guest sees their own name on the
              front.
            </p>
          </div>
          <div>
            <span className="step-no">03</span>
            <h3>Watch the replies</h3>
            <p>
              Share a link or a personal one per guest. Track attendance, plus-ones, dietary notes and
              export the list.
            </p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <span className="brand">
          <BrandMark />
        </span>
        <span className="muted small">
          An original design study of the online-stationery workflow. Not affiliated with any
          stationery company.
        </span>
      </footer>
    </div>
  );
}
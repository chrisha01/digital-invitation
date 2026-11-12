'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import EnvelopeCard from './EnvelopeCard';
import InvitationCard from './InvitationCard';
import RsvpForm from './RsvpForm';
import { readableOn, withAlpha } from '@/lib/color';
import { envelopeAnimation } from '@/lib/envelope-animations';
import { resolveEnvelope } from '@/lib/designs';
import { findSeat } from '@/lib/seating';
import { playPaperOpen } from '@/lib/paper-sound';
import { backdropStyle } from '@/lib/backdrop';
import type { Guest, Invitation } from '@/lib/types';

type Stage = 'closed' | 'opening' | 'peek' | 'card' | 'page';

function formatWhen(inv: Invitation): string {
  const start = inv.event.startsAt ? new Date(inv.event.startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return '';
  const date = start.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function icsHref(inv: Invitation): string {
  const stamp = (value: string) =>
    new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gatherly//Invitations//EN',
    'BEGIN:VEVENT',
    `UID:${inv.id}@envelope`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(inv.event.startsAt)}`,
    inv.event.endsAt ? `DTEND:${stamp(inv.event.endsAt)}` : '',
    `SUMMARY:${inv.event.title}`,
    `LOCATION:${inv.event.location}, ${inv.event.address}`,
    `DESCRIPTION:${inv.event.description.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

export default function GuestView({
  inv,
  guest: initialGuest,
  guestName,
}: {
  inv: Invitation;
  guest: Guest | null;
  guestName: string | null;
}) {
  const [stage, setStage] = useState<Stage>(inv.envelope.enabled ? 'closed' : 'card');
  const [guest, setGuest] = useState<Guest | null>(initialGuest);
  const [justSaved, setJustSaved] = useState(false);
  const [settling, setSettling] = useState(false);
  const [leavingEnvelope, setLeavingEnvelope] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const timers = useRef<number[]>([]);
  const opening = envelopeAnimation(
    resolveEnvelope(inv.envelope, inv.designSlug).openAnimation,
  );

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('envelope:sound') === 'off') setSoundOn(false);
    } catch {
      // Private mode: keep the default.
    }
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem('envelope:sound', next ? 'on' : 'off');
    } catch {
      // Storage is a nicety, not a requirement.
    }
    if (next) playPaperOpen();
  }

  const confirmed = useMemo(() => inv.guests.filter((g) => g.status === 'yes'), [inv.guests]);
  const headcount = useMemo(
    () => confirmed.reduce((sum, g) => sum + Math.max(1, g.adults + g.children, 1 + g.plusOnes), 0),
    [confirmed],
  );

  function openEnvelope() {
    if (stage !== 'closed') return;
    if (soundOn) playPaperOpen();
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      setStage('card');
      return;
    }
    // Flap peels first, then the card rises out of the pocket and settles.
    setStage('opening');
    timers.current.push(window.setTimeout(() => setStage('peek'), opening.peekAt));
    timers.current.push(
      window.setTimeout(() => {
        // The full card fades in while the envelope sinks away underneath it.
        setSettling(true);
        setLeavingEnvelope(true);
        setStage('card');
      }, opening.cardAt),
    );
    timers.current.push(window.setTimeout(() => setLeavingEnvelope(false), opening.doneAt));
  }

  const displayName = guest?.name ?? guestName;
  // Seats stay private until the hosts mark the plan final, so a half-drawn
  // room never appears on the invitation.
  const assignedSeat = guest && inv.seating?.finalized ? findSeat(inv.seating, guest.id) : null;
  const envelopeVisible =
    stage === 'closed' || stage === 'opening' || stage === 'peek' || leavingEnvelope;

  return (
    <div
      className="guest-stage"
      style={{
        ...backdropStyle(inv.backdrop),
        ['--hint-ink' as string]: withAlpha(readableOn(inv.backdrop.color1), 0.62),
      }}
    >
      {envelopeVisible ? (
        <div className={`envelope-stage${leavingEnvelope ? ' is-leaving' : ''}`}>
          <EnvelopeCard
            envelope={inv.envelope}
            designSlug={inv.designSlug}
            guestName={displayName}
            monogram={inv.event.host}
            open={stage !== 'closed'}
            peeking={stage === 'peek' || leavingEnvelope}
            peek={
              stage === 'closed' ? null : <InvitationCard inv={inv} />
            }
            onClick={openEnvelope}
            className={
              stage === 'closed' ? 'is-clickable' : stage === 'peek' ? 'is-peek' : 'is-opening'
            }
          />
          <p className="envelope-hint" aria-live="polite">
            {stage === 'closed' ? 'Tap the envelope' : stage === 'opening' ? 'Opening…' : ''}
          </p>
          {/* Kept mounted once the envelope is open so the stage keeps its height
              and the envelope never shifts under the tap. */}
          <button
            type="button"
            className={`sound-toggle${stage === 'closed' ? '' : ' is-hidden'}`}
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-hidden={stage !== 'closed'}
            tabIndex={stage === 'closed' ? 0 : -1}
            disabled={stage !== 'closed'}
            aria-label={soundOn ? 'Turn opening sound off' : 'Turn opening sound on'}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
              <path
                d="M2.5 6h2l3-2.5v9L4.5 10h-2z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.6"
              />
              {soundOn ? (
                <>
                  <path d="M10 5.4c1.2 1.2 1.2 4 0 5.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <path d="M12.2 3.6c2.3 2.3 2.3 7.1 0 9.4" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
                </>
              ) : (
                <path d="M10.2 6.2l4 3.6M14.2 6.2l-4 3.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              )}
            </svg>
            {soundOn ? 'Sound on' : 'Sound off'}
          </button>
        </div>
      ) : null}

      {stage === 'card' ? (
        <div className={`card-stage${settling ? ' is-settling' : ''}`}>
          <InvitationCard inv={inv} />
          <div className="card-stage-actions">
            <button className="btn btn-primary" onClick={() => setStage('page')}>
              Open the invitation
            </button>
            {inv.envelope.enabled ? (
              <button className="btn btn-ghost" onClick={() => setStage('closed')}>
                Back to envelope
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {stage === 'page' ? (
        <div
          className="guest-page"
          style={{
            background: inv.page.background,
            color: inv.page.text,
            fontFamily: inv.page.fontBody,
          }}
        >
          <div className="guest-page-inner">
            <p className="guest-eyebrow" style={{ color: inv.page.accent }}>
              {inv.event.host}
            </p>
            <h1 style={{ fontFamily: inv.page.fontHeading }}>{inv.event.title}</h1>
            <p className="guest-when">{formatWhen(inv)}</p>
            <p className="guest-where">
              {inv.event.location}
              {inv.event.address ? (
                <>
                  <br />
                  <span className="muted">{inv.event.address}</span>
                </>
              ) : null}
            </p>
            {inv.event.description ? <p className="guest-desc">{inv.event.description}</p> : null}
            {inv.event.dressCode ? (
              <p className="guest-dress">
                <span style={{ color: inv.page.accent }}>Dress</span> {inv.event.dressCode}
              </p>
            ) : null}

            {assignedSeat ? (
              <p className="guest-seat">
                <span style={{ color: inv.page.accent }}>Your table</span>
                {assignedSeat.table.name} · chair {assignedSeat.chair}
              </p>
            ) : null}

            <div className="guest-actions">
              <a className="btn btn-primary" href={icsHref(inv)} download={`${inv.title}.ics`}>
                Add to calendar
              </a>
              {inv.event.address ? (
                <a
                  className="btn btn-ghost"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${inv.event.location} ${inv.event.address}`)}`}
                >
                  Directions
                </a>
              ) : null}
            </div>

            {inv.blocks.map((block) => (
              <section className="guest-block" key={block.id}>
                <h2 style={{ fontFamily: inv.page.fontHeading }}>{block.title}</h2>
                {block.body ? (
                  <div className="guest-block-body">
                    {block.body.split('\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                ) : null}
                {block.type === 'link' && block.url ? (
                  <a className="guest-link" href={block.url} target="_blank" rel="noreferrer">
                    Visit link →
                  </a>
                ) : null}
              </section>
            ))}

            {inv.settings.collectRsvp ? (
              justSaved ? (
                <div className="rsvp-thanks">
                  <h3>Thank you{guest?.name ? `, ${guest.name.split(' ')[0]}` : ''}.</h3>
                  <p>
                    {guest?.status === 'yes'
                      ? 'Your reply is in — we cannot wait to see you.'
                      : guest?.status === 'no'
                        ? 'Your reply is in. You will be missed.'
                        : 'Your reply is in. Let us know if anything changes.'}
                  </p>
                  <button className="btn btn-ghost btn-small" onClick={() => setJustSaved(false)}>
                    Change my reply
                  </button>
                </div>
              ) : (
                <RsvpForm
                  inv={inv}
                  guest={guest}
                  onSaved={(saved) => {
                    setGuest(saved);
                    setJustSaved(true);
                  }}
                />
              )
            ) : null}

            {inv.settings.showGuestList && confirmed.length > 0 ? (
              <section className="guest-block">
                <h2 style={{ fontFamily: inv.page.fontHeading }}>Who&rsquo;s coming</h2>
                <p className="guest-list-line">
                  {confirmed.map((g) => g.name).join(' · ')}
                  {headcount > confirmed.length ? ` · ${headcount} guests in all` : ''}
                </p>
              </section>
            ) : null}

            <footer className="guest-footer" style={{ color: inv.page.accent }}>
              Sent with Gatherly
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

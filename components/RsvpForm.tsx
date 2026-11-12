'use client';

import { useState } from 'react';
import type { Guest, Invitation } from '@/lib/types';

type Props = {
  inv: Invitation;
  guest: Guest | null;
  onSaved: (guest: Guest) => void;
};

export default function RsvpForm({ inv, guest, onSaved }: Props) {
  const [name, setName] = useState(guest?.name ?? '');
  const [email, setEmail] = useState(guest?.email ?? '');
  const [household, setHousehold] = useState(guest?.household ?? '');
  const [dietary, setDietary] = useState(guest?.dietary ?? '');
  const [accessibility, setAccessibility] = useState(guest?.accessibility ?? '');
  const [phone, setPhone] = useState(guest?.phone ?? '');
  const [smsConsent, setSmsConsent] = useState(guest?.smsConsent ?? false);
  const [attending, setAttending] = useState<'yes' | 'no' | 'maybe'>(
    guest && guest.status !== 'invited' ? guest.status : 'yes',
  );
  const [plusOnes, setPlusOnes] = useState(guest?.plusOnes ?? 0);
  const [companions, setCompanions] = useState<string[]>(() =>
    guest
      ? inv.guests
          .filter((row) => row.companionOf === guest.id)
          // A placeholder name is not an answer; leave the field empty for it.
          .map((row) => (row.name.startsWith('Guest of ') ? '' : row.name))
      : [],
  );
  const [adults, setAdults] = useState(guest?.adults ?? 1);
  const [children, setChildren] = useState(guest?.children ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(guest?.answers ?? {});
  const [message, setMessage] = useState(guest?.message ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed =
    !!inv.settings.deadline && new Date(inv.settings.deadline).getTime() < Date.now();

  if (closed) {
    return (
      <div className="rsvp-card">
        <h3>RSVPs are closed</h3>
        <p>Replies closed on {new Date(inv.settings.deadline as string).toLocaleDateString()}. Send {inv.event.host} a note if you need to change yours.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please tell us your name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/rsvp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          household,
          dietary,
          accessibility,
          phone: phone.trim(),
          smsConsent: phone.trim() ? smsConsent : false,
          attending,
          plusOnes: inv.settings.allowPlusOnes ? plusOnes : 0,
          adults: inv.settings.headcount ? adults : attending === 'yes' ? 1 : 0,
          children: inv.settings.headcount ? children : 0,
          companions: Array.from({ length: plusOnes }, (_, index) => companions[index] ?? ''),
          answers,
          message,
          guestId: guest?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'That did not save. Please try again.');
      } else {
        onSaved(data.guest as Guest);
      }
    } catch {
      setError('Network problem — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rsvp-card" onSubmit={submit}>
      <h3>{guest && guest.status !== 'invited' ? 'Your reply' : 'Will you join us?'}</h3>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">
          Household or party <span className="muted">(optional)</span>
        </span>
        <input
          className="input"
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          placeholder="e.g. The Alvarez family"
        />
        <span className="field-hint">Helps the hosts group your party and plan the seating.</span>
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="field-label">
            Dietary needs <span className="muted">(optional)</span>
          </span>
          <input
            className="input"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="Allergies, vegetarian, no pork…"
          />
        </label>
        <label className="field">
          <span className="field-label">
            Access needs <span className="muted">(optional)</span>
          </span>
          <input
            className="input"
            value={accessibility}
            onChange={(e) => setAccessibility(e.target.value)}
            placeholder="Step-free access, seating, quiet room…"
          />
        </label>
      </div>

      {inv.settings.textUpdates !== false ? (
        <div className="field">
          <label className="field-label" htmlFor="rsvp-phone">
            Mobile number <span className="muted">(optional)</span>
          </label>
          <input
            id="rsvp-phone"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />
          {phone.trim() ? (
            <label className="consent-row">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
              />
              <span>
                Text me updates about this event. Message rates may apply, and I can ask you to
                stop at any time.
              </span>
            </label>
          ) : null}
          <span className="field-hint">Only used by the hosts to send updates about this event.</span>
        </div>
      ) : null}

      <div className="field">
        <span className="field-label">Reply</span>
        <div className="seg seg-wrap">
          {(['yes', 'no', 'maybe'] as const).map((option) => (
            <button
              type="button"
              key={option}
              className={attending === option ? 'is-on' : ''}
              onClick={() => setAttending(option)}
            >
              {option === 'yes' ? 'Joyfully accept' : option === 'no' ? 'Regretfully decline' : 'Maybe'}
            </button>
          ))}
        </div>
      </div>

      {attending !== 'no' && inv.settings.allowPlusOnes && !inv.settings.headcount ? (
        <label className="field">
          <span className="field-label">Bringing anyone?</span>
          <select className="input" value={plusOnes} onChange={(e) => setPlusOnes(Number(e.target.value))}>
            {Array.from({ length: inv.settings.maxPlusOnes + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Just me' : `${i} guest${i > 1 ? 's' : ''}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {attending !== 'no' && inv.settings.allowPlusOnes && !inv.settings.headcount && plusOnes > 0 ? (
        <div className="companion-fields">
          {Array.from({ length: plusOnes }, (_, index) => (
            <label className="field" key={index}>
              <span className="field-label">
                {plusOnes === 1 ? "Your guest's name" : `Guest ${index + 1}'s name`}
              </span>
              <input
                className="input"
                value={companions[index] ?? ''}
                placeholder="Optional — helps with the seating plan"
                onChange={(e) => {
                  const next = [...companions];
                  next[index] = e.target.value;
                  setCompanions(next);
                }}
              />
            </label>
          ))}
        </div>
      ) : null}

      {attending !== 'no' && inv.settings.headcount ? (
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Adults</span>
            <input
              className="input"
              type="number"
              min={1}
              max={20}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value) || 0)}
            />
          </label>
          <label className="field">
            <span className="field-label">Children</span>
            <input
              className="input"
              type="number"
              min={0}
              max={20}
              value={children}
              onChange={(e) => setChildren(Number(e.target.value) || 0)}
            />
          </label>
        </div>
      ) : null}

      {inv.settings.questions.map((question) => (
        <label className="field" key={question.id}>
          <span className="field-label">{question.label}</span>
          <input
            className="input"
            value={answers[question.id] ?? ''}
            required={question.required}
            onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
          />
        </label>
      ))}

      <label className="field">
        <span className="field-label">Note for the hosts</span>
        <textarea
          className="input textarea"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="btn btn-primary btn-wide" disabled={busy}>
        {busy ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  );
}

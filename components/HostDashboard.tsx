'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BrandMark from './BrandMark';
import DeleteInvitationButton from './DeleteInvitationButton';
import type { EmailBlast, Guest, Invitation, RsvpStatus, TextAudience, TextBlast } from '@/lib/types';

/** Same shape check the send route uses, so the counts here match what goes out. */
function mailOk(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()));
}

const STATUS_LABEL: Record<RsvpStatus, string> = {
  invited: 'Awaiting reply',
  yes: 'Attending',
  no: 'Declined',
  maybe: 'Maybe',
};

export default function HostDashboard({
  inv,
  sms,
  mail,
  role,
}: {
  inv: Invitation;
  sms: { configured: boolean; missing: string[] };
  mail: { configured: boolean; missing: string[] };
  role: 'owner' | 'collaborator';
}) {
  const isOwner = role === 'owner';
  const [guests, setGuests] = useState<Guest[]>(inv.guests);
  const [origin, setOrigin] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tag, setTag] = useState('Friends');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textBody, setTextBody] = useState('');
  const [textAudience, setTextAudience] = useState<TextAudience>('attending');
  const [textArmed, setTextArmed] = useState(false);
  const [textBusy, setTextBusy] = useState(false);
  const [textResult, setTextResult] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextBlast[]>(inv.texts ?? []);
  const [channel, setChannel] = useState<'text' | 'email'>('text');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAudience, setEmailAudience] = useState<TextAudience>('attending');
  const [emailIncludeLink, setEmailIncludeLink] = useState(true);
  const [emailArmed, setEmailArmed] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailBlast[]>(inv.emails ?? []);
  const [collaborators, setCollaborators] = useState<string[]>(inv.collaborators ?? []);
  const [coHostEmail, setCoHostEmail] = useState('');
  const [coHostBusy, setCoHostBusy] = useState(false);
  const [coHostError, setCoHostError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const yes = guests.filter((g) => g.status === 'yes');
  const no = guests.filter((g) => g.status === 'no');
  const pending = guests.filter((g) => g.status === 'invited');
  const headcount = yes.reduce((sum, g) => sum + Math.max(1, g.adults + g.children, 1 + g.plusOnes), 0);
  const answered = guests.filter((g) => g.status !== 'invited').length;
  const sharePath = `/i/${inv.id}`;

  // Texting only ever reaches guests with a number and a tick.
  const consented = guests.filter((g) => g.phone && g.smsConsent);
  const textCounts = {
    attending: consented.filter((g) => g.status === 'yes').length,
    pending: consented.filter((g) => g.status === 'invited').length,
    all: consented.length,
  };
  const textTargets = consented.filter((g) =>
    textAudience === 'attending'
      ? g.status === 'yes'
      : textAudience === 'pending'
        ? g.status === 'invited'
        : true,
  );
  const unconsented = guests.filter((g) => g.phone && !g.smsConsent).length;
  const textSegments = Math.max(1, Math.ceil(textBody.length / 160));

  const emailable = guests.filter((g) => mailOk(g.email));
  const emailCounts = {
    attending: emailable.filter((g) => g.status === 'yes').length,
    pending: emailable.filter((g) => g.status === 'invited').length,
    all: emailable.length,
  };
  const emailTargets = emailable.filter((g) =>
    emailAudience === 'attending'
      ? g.status === 'yes'
      : emailAudience === 'pending'
        ? g.status === 'invited'
        : true,
  );
  const unaddressed = guests.length - emailable.length;

  const answerLines = useMemo(
    () =>
      guests
        .filter((g) => Object.values(g.answers).some(Boolean) || g.message)
        .map((g) => ({ guest: g, entries: Object.entries(g.answers).filter(([, v]) => v) })),
    [guests],
  );

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'That did not save.');
        return null;
      }
      return data;
    } catch {
      setError('Network problem — please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const data = await call(`/api/invitations/${inv.id}/guests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, tag }),
    });
    if (data?.guests) {
      setGuests(data.guests);
      setName('');
      setEmail('');
    }
  }

  async function updateStatus(guestId: string, status: RsvpStatus) {
    const data = await call(`/api/invitations/${inv.id}/guests`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guestId, patch: { status } }),
    });
    if (data?.guests) setGuests(data.guests);
  }

  async function renameGuest(guestId: string, name: string) {
    const data = await call(`/api/invitations/${inv.id}/guests`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guestId, patch: { name } }),
    });
    if (data?.guests) setGuests(data.guests);
  }

  async function removeGuest(guestId: string) {
    const data = await call(`/api/invitations/${inv.id}/guests?guestId=${encodeURIComponent(guestId)}`, {
      method: 'DELETE',
    });
    if (data?.guests) setGuests(data.guests);
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError('Copying needs clipboard permission in this browser.');
    }
  }

  function exportCsv() {
    const header = ['Name', 'Email', 'Mobile', 'Text updates', 'Group', 'Reply', 'Additional guests', 'Adults', 'Children', 'Message'];
    const rows = guests.map((g) => [
      g.name,
      g.email,
      g.phone ?? '',
      g.phone ? (g.smsConsent ? 'Yes' : 'No') : '',
      g.tag,
      STATUS_LABEL[g.status],
      String(g.plusOnes),
      String(g.adults),
      String(g.children),
      g.message.replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.title.replace(/\s+/g, '-').toLowerCase()}-guests.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendTexts() {
    if (!textBody.trim() || !textTargets.length) return;
    if (!textArmed) {
      setTextArmed(true);
      setTextError(null);
      return;
    }
    setTextBusy(true);
    setTextError(null);
    setTextResult(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/texts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: textBody, audience: textAudience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTextError(
          res.status === 501
            ? `Sending is off until an SMS provider is connected. Add ${(data.missing ?? []).join(', ')} to .env and restart.`
            : data?.error ?? 'Could not send.',
        );
        setTextArmed(false);
        if (data?.texts) setTexts(data.texts);
      } else {
        setTextResult(
          `Sent ${data.sent} of ${data.recipients} text${data.recipients === 1 ? '' : 's'}${
            data.failed ? ` · ${data.failed} failed` : ''
          }.`,
        );
        setTexts(data.texts ?? []);
        setTextBody('');
        setTextArmed(false);
      }
    } catch {
      setTextError('Network problem — the texts were not sent.');
    } finally {
      setTextBusy(false);
    }
  }

  async function sendEmails() {
    if (!emailSubject.trim() || !emailBody.trim() || !emailTargets.length) return;
    if (!emailArmed) {
      setEmailArmed(true);
      setEmailError(null);
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    setEmailResult(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/emails`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          audience: emailAudience,
          includeLink: emailIncludeLink,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(
          res.status === 501
            ? `Sending is off until an email provider is connected. Add ${(data.missing ?? []).join(', ')} to .env and restart.`
            : data?.error ?? 'Could not send.',
        );
        setEmailArmed(false);
        if (data?.emails) setEmails(data.emails);
      } else {
        setEmailResult(
          `Sent ${data.sent} of ${data.recipients} email${data.recipients === 1 ? '' : 's'}${
            data.failed ? ` · ${data.failed} failed` : ''
          }.`,
        );
        setEmails(data.emails ?? []);
        setEmailArmed(false);
      }
    } catch {
      setEmailError('Network problem — the emails were not sent.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function addCoHost(e: React.FormEvent) {
    e.preventDefault();
    if (!coHostEmail.trim()) return;
    setCoHostBusy(true);
    setCoHostError(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/collaborators`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: coHostEmail }),
      });
      const data = await res.json();
      if (!res.ok) setCoHostError(data?.error ?? 'That did not save.');
      else {
        setCollaborators(data.collaborators ?? []);
        setCoHostEmail('');
      }
    } catch {
      setCoHostError('Network problem — please try again.');
    } finally {
      setCoHostBusy(false);
    }
  }

  async function removeCoHost(email: string) {
    setCoHostBusy(true);
    setCoHostError(null);
    try {
      const res = await fetch(
        `/api/invitations/${inv.id}/collaborators?email=${encodeURIComponent(email)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) setCoHostError(data?.error ?? 'That did not save.');
      else setCollaborators(data.collaborators ?? []);
    } catch {
      setCoHostError('Network problem — please try again.');
    } finally {
      setCoHostBusy(false);
    }
  }

  function copyNumbers() {
    const lines = guests
      .filter((g) => g.phone && g.smsConsent)
      .map((g) => `${g.name}: ${g.phone}`);
    if (lines.length) copy(lines.join('\n'), 'phones');
  }

  return (
    <div className="host-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand">
            <BrandMark />
          </Link>
          <span className="crumb">/</span>
          <span className="host-title">{inv.title}</span>
        </div>
        <div className="topbar-right">
          {isOwner ? (
            <DeleteInvitationButton id={inv.id} title={inv.title} redirectTo="/" label="Delete" />
          ) : null}
          <Link className="btn btn-ghost" href={`/host/${inv.id}/seating`}>
            Seating plan
          </Link>
          <Link className="btn btn-ghost" href={`/create?id=${inv.id}`}>
            Edit design
          </Link>
          <Link className="btn btn-primary" href={sharePath} target="_blank" rel="noreferrer">
            View invitation
          </Link>
        </div>
      </header>

      <main className="host-main">
        <section className="share-panel">
          <div>
            <h1 className="host-heading">{inv.event.title}</h1>
            <p className="muted">
              {inv.event.host} · {inv.event.location}
            </p>
          </div>
          <div className="share-row">
            <input className="input mono" readOnly value={origin ? `${origin}${sharePath}` : sharePath} />
            <button
              className="btn btn-ghost"
              onClick={() => copy(origin ? `${origin}${sharePath}` : sharePath, 'share')}
            >
              {copied === 'share' ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </section>

        <section className="stat-row">
          <div className="stat">
            <span className="stat-value">{guests.length}</span>
            <span className="stat-label">Invited</span>
          </div>
          <div className="stat">
            <span className="stat-value">{yes.length}</span>
            <span className="stat-label">Attending</span>
          </div>
          <div className="stat">
            <span className="stat-value">{headcount}</span>
            <span className="stat-label">Total heads</span>
          </div>
          <div className="stat">
            <span className="stat-value">{no.length}</span>
            <span className="stat-label">Declined</span>
          </div>
          <div className="stat">
            <span className="stat-value">{pending.length}</span>
            <span className="stat-label">Awaiting</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {guests.length ? Math.round((answered / guests.length) * 100) : 0}%
            </span>
            <span className="stat-label">Replied</span>
          </div>
        </section>

        {inv.settings.capacity ? (
          <p className="muted small">
            Capacity {inv.settings.capacity}. {headcount} seats taken.
            {headcount >= inv.settings.capacity ? ' The event is full.' : ''}
          </p>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">Who can manage this</h2>
            <span className="muted small">{isOwner ? 'You are the owner' : 'You are a co-host'}</span>
          </div>
          <p className="panel-note">
            Co-hosts can see replies, edit the invitation, seat guests and send texts. Only the owner
            can delete the invitation or change this list.
          </p>
          {collaborators.length ? (
            <ul className="share-list">
              {collaborators.map((email) => (
                <li key={email}>
                  <span>{email}</span>
                  {isOwner ? (
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={coHostBusy}
                      onClick={() => removeCoHost(email)}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nobody else yet.</p>
          )}
          {isOwner ? (
            <form className="add-guest" onSubmit={addCoHost}>
              <input
                className="input"
                type="email"
                placeholder="Co-host email"
                value={coHostEmail}
                onChange={(e) => setCoHostEmail(e.target.value)}
                required
              />
              <button className="btn btn-primary" disabled={coHostBusy}>
                Add co-host
              </button>
            </form>
          ) : null}
          {isOwner ? (
            <p className="muted small">
              They get access as soon as they sign in with that email — no invitation email is sent.
            </p>
          ) : null}
          {coHostError ? <p className="form-error">{coHostError}</p> : null}
        </section>

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">Guest list</h2>
            <div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={exportCsv} disabled={!guests.length}>
                Export CSV
              </button>
              <button
                className="btn btn-ghost btn-small"
                onClick={copyNumbers}
                disabled={!guests.some((g) => g.phone && g.smsConsent)}
              >
                {copied === 'phones' ? 'Copied' : 'Copy numbers'}
              </button>
            </div>
          </div>

          <form className="add-guest" onSubmit={addGuest}>
            <input
              className="input"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              placeholder="Group"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
            <button className="btn btn-primary" disabled={busy}>
              Add guest
            </button>
          </form>

          {guests.length === 0 ? (
            <p className="panel-note">
              No guests yet. Add names here, then send each person their link — or share one link with
              everyone and let them reply.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="guest-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Group</th>
                    <th>Reply</th>
                    <th>Party</th>
                    <th>Answers</th>
                    <th>Link</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest) => {
                    const entries = Object.entries(guest.answers).filter(([, value]) => value);
                    return (
                      <tr key={guest.id}>
                        <td>
                          <input
                            className="input guest-name"
                            defaultValue={guest.name}
                            aria-label={`Name for ${guest.name}`}
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next && next !== guest.name) renameGuest(guest.id, next);
                              else e.target.value = guest.name;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                          />
                          {guest.companionOf ? <div className="muted small">Plus one</div> : null}
                          {guest.email ? <div className="muted small">{guest.email}</div> : null}
                          {guest.phone ? (
                            <div className="muted small">
                              {guest.phone}
                              <span className={`sms-tag${guest.smsConsent ? '' : ' is-off'}`}>
                                {guest.smsConsent ? 'Text OK' : 'No consent'}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td>{guest.tag || '—'}</td>
                        <td>
                          <select
                            className={`input status-select is-${guest.status}`}
                            value={guest.status}
                            onChange={(e) => updateStatus(guest.id, e.target.value as RsvpStatus)}
                          >
                            {(Object.keys(STATUS_LABEL) as RsvpStatus[]).map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {guest.status === 'yes'
                            ? `${Math.max(1, guest.adults + guest.children, 1 + guest.plusOnes)}`
                            : '—'}
                        </td>
                        <td className="answers-cell">
                          {entries.map(([questionId, value]) => {
                            const question = inv.settings.questions.find((q) => q.id === questionId);
                            return (
                              <div key={questionId} className="answer-line">
                                <span className="muted small">{question?.label ?? 'Answer'}</span>
                                <div>{value}</div>
                              </div>
                            );
                          })}
                          {guest.message ? <div className="answer-line">“{guest.message}”</div> : null}
                          {!entries.length && !guest.message ? <span className="muted">—</span> : null}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-small"
                            onClick={() =>
                              copy(
                                `${origin}/i/${inv.id}?g=${guest.id}`,
                                guest.id,
                              )
                            }
                          >
                            {copied === guest.id ? 'Copied' : 'Personal link'}
                          </button>
                        </td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={`Remove ${guest.name}`}
                            onClick={() => removeGuest(guest.id)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">Message guests</h2>
            <div className="seg">
              <button className={channel === 'text' ? 'is-on' : ''} onClick={() => setChannel('text')}>
                Text
              </button>
              <button
                className={channel === 'email' ? 'is-on' : ''}
                onClick={() => setChannel('email')}
              >
                Email
              </button>
            </div>
          </div>

          {channel === 'text' ? (
            <>
          <p className="panel-note">
            Only guests who left a number and ticked the consent box are messaged —{' '}
            {consented.length} of them. Useful for a time change, directions or a last-minute nudge.
          </p>

          {!sms.configured ? (
            <p className="text-setup">
              Sending is off until an SMS provider is connected. Add{' '}
              <code>{sms.missing.join('</code>, <code>')}</code> to <code>.env</code> and restart — the
              message and audience you pick here will go through it.
            </p>
          ) : null}

          <textarea
            className="input textarea"
            rows={3}
            maxLength={480}
            value={textBody}
            placeholder="e.g. Doors at six — the lane is closed, so park on Marlow."
            onChange={(e) => {
              setTextBody(e.target.value);
              setTextArmed(false);
              setTextResult(null);
            }}
          />
          <div className="text-meta">
            <span>
              {textBody.length} characters · {textSegments} {textSegments === 1 ? 'message' : 'messages'}
            </span>
            <span>
              {textTargets.length} recipient{textTargets.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="row-actions">
            <select
              className="input"
              aria-label="Who to text"
              value={textAudience}
              onChange={(e) => {
                setTextAudience(e.target.value as TextAudience);
                setTextArmed(false);
                setTextResult(null);
              }}
            >
              <option value="attending">Guests who are coming ({textCounts.attending})</option>
              <option value="pending">No reply yet ({textCounts.pending})</option>
              <option value="all">Everyone with consent ({textCounts.all})</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={sendTexts}
              disabled={!sms.configured || textBusy || !textBody.trim() || !textTargets.length}
            >
              {textBusy
                ? 'Sending…'
                : textArmed
                  ? `Confirm — send ${textTargets.length} text${textTargets.length === 1 ? '' : 's'}`
                  : 'Send text'}
            </button>
            {textArmed ? (
              <button className="btn btn-ghost btn-small" onClick={() => setTextArmed(false)}>
                Cancel
              </button>
            ) : null}
          </div>

          {unconsented ? (
            <p className="muted small">
              {unconsented} guest{unconsented === 1 ? ' has' : 's have'} a number without consent and
              will be skipped.
            </p>
          ) : null}
          {textError ? <p className="form-error">{textError}</p> : null}
          {textResult ? <p className="text-result">{textResult}</p> : null}

          {texts.length ? (
            <div className="text-history">
              <h3 className="field-label">Sent</h3>
              {texts
                .slice()
                .reverse()
                .map((blast) => (
                  <div className="text-history-row" key={blast.id}>
                    <p>{blast.body}</p>
                    <span className="muted small">
                      {new Date(blast.sentAt).toLocaleString()} ·{' '}
                      {blast.status === 'not-configured'
                        ? 'not sent — provider not connected'
                        : `${blast.delivered} of ${blast.recipients} sent${blast.failed ? ` · ${blast.failed} failed` : ''}`}
                    </span>
                  </div>
                ))}
            </div>
          ) : null}
            </>
          ) : (
            <>
              <p className="panel-note">
                Mailed through your own provider — there is no mail server to run here. Guests with
                an address get a copy; {unaddressed} {unaddressed === 1 ? 'guest has' : 'guests have'}{' '}
                no address and are skipped.
              </p>

              {!mail.configured ? (
                <p className="text-setup">
                  Sending is off until an email provider is connected. Add{' '}
                  <code>{mail.missing.join('</code>, <code>')}</code> to <code>.env</code> and
                  restart — the subject, message and audience you pick here will go through it.
                </p>
              ) : null}

              <label className="field">
                <span className="field-label">Subject</span>
                <input
                  className="input"
                  maxLength={140}
                  value={emailSubject}
                  placeholder={`${inv.title} — a quick update`}
                  onChange={(e) => {
                    setEmailSubject(e.target.value);
                    setEmailArmed(false);
                    setEmailResult(null);
                  }}
                />
              </label>

              <textarea
                className="input textarea"
                rows={5}
                maxLength={4000}
                value={emailBody}
                placeholder="e.g. Doors at six — the lane is closed, so park on Marlow."
                onChange={(e) => {
                  setEmailBody(e.target.value);
                  setEmailArmed(false);
                  setEmailResult(null);
                }}
              />
              <div className="text-meta">
                <span>{emailBody.length} characters</span>
                <span>
                  {emailTargets.length} recipient{emailTargets.length === 1 ? '' : 's'}
                </span>
              </div>

              <label className="inline-check message-link-check">
                <input
                  type="checkbox"
                  checked={emailIncludeLink}
                  onChange={(e) => setEmailIncludeLink(e.target.checked)}
                />
                Add each guest&rsquo;s personal link
              </label>

              <div className="row-actions">
                <select
                  className="input"
                  aria-label="Who to email"
                  value={emailAudience}
                  onChange={(e) => {
                    setEmailAudience(e.target.value as TextAudience);
                    setEmailArmed(false);
                    setEmailResult(null);
                  }}
                >
                  <option value="attending">Guests who are coming ({emailCounts.attending})</option>
                  <option value="pending">No reply yet ({emailCounts.pending})</option>
                  <option value="all">Everyone with an address ({emailCounts.all})</option>
                </select>
                <button
                  className="btn btn-primary"
                  onClick={sendEmails}
                  disabled={
                    !mail.configured ||
                    emailBusy ||
                    !emailSubject.trim() ||
                    !emailBody.trim() ||
                    !emailTargets.length
                  }
                >
                  {emailBusy
                    ? 'Sending…'
                    : emailArmed
                      ? `Confirm — send ${emailTargets.length} email${emailTargets.length === 1 ? '' : 's'}`
                      : 'Send email'}
                </button>
                {emailArmed ? (
                  <button className="btn btn-ghost btn-small" onClick={() => setEmailArmed(false)}>
                    Cancel
                  </button>
                ) : null}
              </div>

              {emailError ? <p className="form-error">{emailError}</p> : null}
              {emailResult ? <p className="text-result">{emailResult}</p> : null}

              {emails.length ? (
                <div className="text-history">
                  <h3 className="field-label">Sent</h3>
                  {emails
                    .slice()
                    .reverse()
                    .map((blast) => (
                      <div className="text-history-row" key={blast.id}>
                        <p>
                          <strong>{blast.subject}</strong> — {blast.body}
                        </p>
                        <span className="muted small">
                          {new Date(blast.sentAt).toLocaleString()} ·{' '}
                          {blast.status === 'not-configured'
                            ? 'not sent — provider not connected'
                            : `${blast.delivered} of ${blast.recipients} sent${blast.failed ? ` · ${blast.failed} failed` : ''}`}
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
            </>
          )}
        </section>

        {answerLines.length ? (
          <section className="host-card">
            <h2 className="panel-title">Notes from guests</h2>
            {answerLines.map(({ guest, entries }) => (
              <div key={guest.id} className="note-line">
                <strong>{guest.name}</strong>
                {entries.map(([questionId, value]) => {
                  const question = inv.settings.questions.find((q) => q.id === questionId);
                  return (
                    <div key={questionId}>
                      <span className="muted small">{question?.label ?? 'Answer'}: </span>
                      {value}
                    </div>
                  );
                })}
                {guest.message ? <div>“{guest.message}”</div> : null}
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

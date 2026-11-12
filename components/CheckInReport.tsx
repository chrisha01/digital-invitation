'use client';

import Link from 'next/link';
import BrandMark from './BrandMark';
import { checkInCounts, guestHeads } from '@/lib/checkin';
import type { Guest, Invitation } from '@/lib/types';

const houseOf = (guest: Guest) => guest.household?.trim() || guest.tag?.trim() || 'Unassigned';

export default function CheckInReport({ inv }: { inv: Invitation }) {
  const guests = inv.guests;
  const counts = checkInCounts(inv);
  const confirmed = guests.filter((guest) => guest.status === 'yes');
  const noShows = confirmed.filter((guest) => !guest.checkedInAt);
  const walkIns = guests.filter((guest) => guest.checkedInAt && guest.status !== 'yes');
  const missingHeads = noShows.reduce((sum, guest) => sum + guestHeads(guest), 0);
  const confirmedHeads = confirmed.reduce((sum, guest) => sum + guestHeads(guest), 0);
  const checkedInHeads = guests
    .filter((guest) => guest.checkedInAt)
    .reduce((sum, guest) => sum + Math.max(1, guestHeads(guest)), 0);

  const households = new Map<
    string,
    { rows: number; confirmed: number; here: number; missing: number; guests: string[] }
  >();
  for (const guest of guests) {
    const key = houseOf(guest);
    const entry = households.get(key) ?? { rows: 0, confirmed: 0, here: 0, missing: 0, guests: [] };
    entry.rows += 1;
    entry.guests.push(guest.name);
    if (guest.status === 'yes') entry.confirmed += guestHeads(guest);
    if (guest.checkedInAt) entry.here += Math.max(1, guestHeads(guest));
    if (guest.status === 'yes' && !guest.checkedInAt) entry.missing += guestHeads(guest);
    households.set(key, entry);
  }

  const diet = guests.filter((guest) => guest.dietary?.trim());
  const access = guests.filter((guest) => guest.accessibility?.trim());

  function exportReport() {
    const header = [
      'Name',
      'Household',
      'Reply',
      'Party',
      'Checked in',
      'Checked in at',
      'Dietary',
      'Accessibility',
    ];
    const rows = guests.map((guest) => [
      guest.name,
      guest.household ?? '',
      guest.status,
      guest.status === 'yes' ? String(guestHeads(guest)) : '0',
      guest.checkedInAt ? 'Yes' : 'No',
      guest.checkedInAt ? new Date(guest.checkedInAt).toLocaleString() : '',
      guest.dietary ?? '',
      guest.accessibility ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.title.replace(/\s+/g, '-').toLowerCase()}-attendance-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="host-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand">
            <BrandMark />
          </Link>
          <span className="crumb">/</span>
          <span className="host-title">{inv.title} · Attendance report</span>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn btn-ghost" onClick={exportReport}>
            Export CSV
          </button>
          <Link className="btn btn-primary" href={`/host/${inv.id}/checkin`}>
            Check-in
          </Link>
        </div>
      </header>

      <main className="host-main">
        <section className="stat-row">
          <div className="stat">
            <span className="stat-value">{confirmedHeads}</span>
            <span className="stat-label">Confirmed heads</span>
          </div>
          <div className="stat">
            <span className="stat-value">{checkedInHeads}</span>
            <span className="stat-label">Actually arrived</span>
          </div>
          <div className="stat">
            <span className="stat-value">{missingHeads}</span>
            <span className="stat-label">No-shows</span>
          </div>
          <div className="stat">
            <span className="stat-value">{walkIns.length}</span>
            <span className="stat-label">Walk-ins</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {counts.expected ? Math.round((counts.checkedIn / counts.expected) * 100) : 0}%
            </span>
            <span className="stat-label">Turnout</span>
          </div>
        </section>

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">By household</h2>
            <span className="muted small">{households.size} households &amp; groups</span>
          </div>
          <div className="table-wrap">
            <table className="guest-table">
              <thead>
                <tr>
                  <th>Household</th>
                  <th>Rows</th>
                  <th>Confirmed</th>
                  <th>Arrived</th>
                  <th>Missing</th>
                </tr>
              </thead>
              <tbody>
                {[...households.entries()]
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([name, entry]) => (
                    <tr key={name}>
                      <td>
                        <strong>{name}</strong>
                        <div className="muted small">{entry.guests.join(' · ')}</div>
                      </td>
                      <td>{entry.rows}</td>
                      <td>{entry.confirmed}</td>
                      <td>{entry.here}</td>
                      <td>{entry.missing || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">Did not arrive</h2>
            <span className="muted small">{missingHeads} heads confirmed but unseen</span>
          </div>
          {noShows.length ? (
            <ul className="report-list">
              {noShows.map((guest) => (
                <li key={guest.id}>
                  <strong>{guest.name}</strong>{' '}
                  <span className="muted small">
                    {houseOf(guest)} · party of {guestHeads(guest)}
                    {guest.phone ? ` · ${guest.phone}` : ''}
                    {guest.email ? ` · ${guest.email}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-note">Everyone who confirmed has been checked in.</p>
          )}
        </section>

        {walkIns.length ? (
          <section className="host-card">
            <div className="panel-head">
              <h2 className="panel-title">Walk-ins</h2>
              <span className="muted small">Arrived without a yes on the list</span>
            </div>
            <ul className="report-list">
              {walkIns.map((guest) => (
                <li key={guest.id}>
                  <strong>{guest.name}</strong>{' '}
                  <span className="muted small">
                    {houseOf(guest)} · replied {guest.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">Dietary &amp; access</h2>
            <span className="muted small">
              {diet.length} dietary · {access.length} access
            </span>
          </div>
          {diet.length || access.length ? (
            <div className="grid-2">
              <div>
                <h3 className="field-label">Dietary</h3>
                {diet.length ? (
                  <ul className="report-list">
                    {diet.map((guest) => (
                      <li key={guest.id}>
                        <strong>{guest.name}</strong>{' '}
                        <span className="muted small">{guest.dietary}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Nobody has reported a need.</p>
                )}
              </div>
              <div>
                <h3 className="field-label">Accessibility</h3>
                {access.length ? (
                  <ul className="report-list">
                    {access.map((guest) => (
                      <li key={guest.id}>
                        <strong>{guest.name}</strong>{' '}
                        <span className="muted small">{guest.accessibility}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Nobody has asked for anything yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="panel-note">
              Guests can tell you about allergies, step-free access or a quiet corner when they reply;
              those notes collect here.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

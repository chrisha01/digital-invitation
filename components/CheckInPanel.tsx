'use client';

import Link from 'next/link';
import jsQR from 'jsqr';
import { useEffect, useMemo, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import { checkInCounts, guestHeads } from '@/lib/checkin';
import type { Guest, Invitation } from '@/lib/types';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function nativeDetectorCtor(): BarcodeDetectorCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

const STATUS_LABEL: Record<Guest['status'], string> = {
  invited: 'Awaiting reply',
  yes: 'Attending',
  no: 'Declined',
  maybe: 'Maybe',
};

export default function CheckInPanel({ inv }: { inv: Invitation }) {
  const [guests, setGuests] = useState<Guest[]>(inv.guests);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [flash, setFlash] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScan = useRef({ code: '', at: 0 });
  const busyRef = useRef(false);

  const counts = useMemo(() => checkInCounts({ ...inv, guests }), [inv, guests]);
  const walkIns = guests.filter((guest) => guest.checkedInAt && guest.status !== 'yes').length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guests
      .filter((guest) => !guest.companionOf || guest.checkedInAt)
      .filter(
        (guest) =>
          !needle ||
          guest.name.toLowerCase().includes(needle) ||
          (guest.household ?? '').toLowerCase().includes(needle) ||
          (guest.email ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        if (Boolean(a.checkedInAt) !== Boolean(b.checkedInAt)) return a.checkedInAt ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [guests, query]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    // Chrome on Android and macOS can decode natively; everywhere else (notably
    // Windows and Firefox) the same frames go through jsQR on a canvas.
    let native: BarcodeDetectorLike | null = null;
    if (nativeDetectorCtor()) {
      try {
        native = new (nativeDetectorCtor() as BarcodeDetectorCtor)({ formats: ['qr_code'] });
      } catch {
        native = null;
      }
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    async function tick() {
      if (stopped) return;
      const frame = videoRef.current;
      let value: string | undefined;
      if (frame && frame.readyState >= 2 && frame.videoWidth) {
        try {
          if (native) {
            value = (await native.detect(frame))[0]?.rawValue;
          } else if (context) {
            const width = 360;
            const height = Math.round((frame.videoHeight / frame.videoWidth) * width);
            canvas.width = width;
            canvas.height = height;
            context.drawImage(frame, 0, 0, width, height);
            const image = context.getImageData(0, 0, width, height);
            value = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' })?.data;
          }
        } catch {
          // A frame without a code is normal; keep looking.
        }
      }

      const now = Date.now();
      if (
        !stopped &&
        value &&
        !busyRef.current &&
        (value !== lastScan.current.code || now - lastScan.current.at > 4000)
      ) {
        lastScan.current = { code: value, at: now };
        await submit({ code: value });
      }
      if (!stopped) window.setTimeout(tick, 500);
    }

    tick();
    return () => {
      stopped = true;
    };
    // submit is stable enough for this loop; the ref guards double scans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function startCamera() {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setScanError('The camera could not start. Allow camera access, or check guests in by name.');
    }
  }

  async function submit(payload: { code?: string; guestId?: string; undo?: boolean }) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash({ tone: 'bad', text: data?.error ?? 'That pass was not recognised.' });
      } else {
        setGuests(data.guests as Guest[]);
        const guest = data.guest as Guest | null;
        if (guest) {
          setFlash({
            tone: 'ok',
            text: payload.undo
              ? `${guest.name} checked out.`
              : `${guest.name} checked in — ${guest.household || 'party'} of ${Math.max(1, guestHeads(guest))}.`,
          });
          setCode('');
        }
      }
    } catch {
      setFlash({ tone: 'bad', text: 'Network problem — that check-in did not save.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function exportAttendance() {
    const header = ['Name', 'Household', 'Reply', 'Party', 'Checked in', 'Checked in by'];
    const rows = guests.map((guest) => [
      guest.name,
      guest.household ?? '',
      STATUS_LABEL[guest.status],
      guest.status === 'yes' ? String(guestHeads(guest)) : '0',
      guest.checkedInAt ? new Date(guest.checkedInAt).toLocaleString() : 'No',
      guest.checkedInBy ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.title.replace(/\s+/g, '-').toLowerCase()}-check-in.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const percent = counts.expected ? Math.round((counts.checkedIn / counts.expected) * 100) : 0;

  return (
    <div className="host-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand">
            <BrandMark />
          </Link>
          <span className="crumb">/</span>
          <span className="host-title">{inv.title} · Check-in</span>
        </div>
        <div className="topbar-right">
          <Link className="btn btn-ghost" href={`/host/${inv.id}/checkin/report`}>
            Report
          </Link>
          <Link className="btn btn-ghost" href={`/host/${inv.id}`}>
            Dashboard
          </Link>
        </div>
      </header>

      <main className="host-main">
        <section className="stat-row">
          <div className="stat">
            <span className="stat-value">{counts.checkedIn}</span>
            <span className="stat-label">Here now</span>
          </div>
          <div className="stat">
            <span className="stat-value">{counts.expected}</span>
            <span className="stat-label">Expected</span>
          </div>
          <div className="stat">
            <span className="stat-value">{counts.remaining}</span>
            <span className="stat-label">Still out</span>
          </div>
          <div className="stat">
            <span className="stat-value">{walkIns}</span>
            <span className="stat-label">Walk-ins</span>
          </div>
        </section>

        <p className="checkin-progress">
          <span style={{ width: `${percent}%` }} />
          <em>
            {counts.rows} of {guests.length} guests checked in · {percent}% of expected heads
          </em>
        </p>

        <section className="host-card">
          <div className="panel-head">
            <h2 className="panel-title">Scan a pass</h2>
            <span className="muted small">Guest passes are on each invitation page</span>
          </div>

          <div className="scan-row">
            <button className="btn btn-primary" onClick={scanning ? stopCamera : startCamera}>
              {scanning ? 'Stop camera' : 'Use camera'}
            </button>
            <form
              className="scan-manual"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) submit({ code: code.trim() });
              }}
            >
              <input
                className="input mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste a pass code, or type a name below"
                aria-label="Pass code"
              />
              <button className="btn btn-ghost" disabled={busy || !code.trim()}>
                Check in
              </button>
            </form>
          </div>

          {scanning ? (
            <div className="scan-frame">
              <video ref={videoRef} muted playsInline />
              <span>Hold the guest’s pass inside the frame</span>
            </div>
          ) : null}
          {scanError ? <p className="form-error">{scanError}</p> : null}

          <label className="field">
            <span className="field-label">Find a guest</span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, household or email"
            />
          </label>

          {flash ? (
            <p className={flash.tone === 'ok' ? 'checkin-flash is-ok' : 'checkin-flash is-bad'}>
              {flash.text}
            </p>
          ) : null}

          <div className="table-wrap">
            <table className="guest-table checkin-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Household</th>
                  <th>Reply</th>
                  <th>Party</th>
                  <th>Arrived</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((guest) => (
                  <tr key={guest.id} className={guest.checkedInAt ? 'is-in' : ''}>
                    <td>
                      <strong>{guest.name}</strong>
                      {guest.dietary ? <div className="muted small">Diet: {guest.dietary}</div> : null}
                      {guest.accessibility ? (
                        <div className="muted small">Access: {guest.accessibility}</div>
                      ) : null}
                    </td>
                    <td>{guest.household || '—'}</td>
                    <td>{STATUS_LABEL[guest.status]}</td>
                    <td>{guest.status === 'yes' ? guestHeads(guest) : '—'}</td>
                    <td>
                      {guest.checkedInAt ? (
                        <>
                          {new Date(guest.checkedInAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {guest.checkedInBy ? (
                            <div className="muted small">by {guest.checkedInBy}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {guest.checkedInAt ? (
                        <button
                          className="btn btn-ghost btn-small"
                          disabled={busy}
                          onClick={() => submit({ guestId: guest.id, undo: true })}
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-small"
                          disabled={busy}
                          onClick={() => submit({ guestId: guest.id })}
                        >
                          Check in
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-actions">
            <button className="btn btn-ghost btn-small" onClick={exportAttendance}>
              Export attendance CSV
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

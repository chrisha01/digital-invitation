'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import InvitationCard from '@/components/InvitationCard';
import {
  DESIGNS,
  defaultBackdrop,
  defaultCard,
  defaultEnvelope,
  getDesign,
} from '@/lib/designs';
import type { Invitation } from '@/lib/types';

type Status = 'saved' | 'saving' | 'error';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO date → the value a datetime-local input expects. */
function toLocalInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * A compact, phone-sized card editor: the words, the design, the ink and the
 * event details. The full desktop editor still owns portraits, uploads,
 * envelope artwork, blocks and RSVP settings.
 */
export default function AppCardEditor({ initial }: { initial: Invitation }) {
  const [inv, setInv] = useState(initial);
  const [status, setStatus] = useState<Status>('saved');
  const [zoom, setZoom] = useState(false);
  const router = useRouter();
  const titlesRef = useRef<HTMLElement>(null);
  const wordsRef = useRef<HTMLElement>(null);
  const designRef = useRef<HTMLElement>(null);
  const inkRef = useRef<HTMLElement>(null);
  const eventRef = useRef<HTMLElement>(null);
  const layerInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focusBack = useRef<HTMLElement | null>(null);

  const jumpTo = (target: React.RefObject<HTMLElement | null>) =>
    target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Tapping a line in the enlarged preview puts the cursor in that line's field.
  // Focus after the smooth scroll so the browser and the scroll agree on where
  // to land (and the keyboard opening doesn't cancel the scroll).
  function jumpToLayer(layerId: string) {
    const input = layerInputs.current[layerId];
    setZoom(false);
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      input.focus({ preventScroll: true });
      input.select();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 320);
  }
  // What the database holds, so an untouched editor never re-saves on mount.
  const lastSaved = useRef(JSON.stringify(initial));
  const latest = useRef(inv);
  latest.current = inv;

  async function saveNow(data: Invitation): Promise<boolean> {
    const serialized = JSON.stringify(data);
    setStatus('saving');
    try {
      const res = await fetch(`/api/invitations/${data.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: serialized,
      });
      if (res.ok) lastSaved.current = serialized;
      setStatus(res.ok ? 'saved' : 'error');
      return res.ok;
    } catch {
      setStatus('error');
      return false;
    }
  }

  useEffect(() => {
    const serialized = JSON.stringify(inv);
    if (serialized === lastSaved.current) return;
    const timer = setTimeout(() => void saveNow(inv), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv]);

  // The enlarged preview is a modal: Escape closes it, focus starts on Close,
  // Tab stays inside, and the thumbnail gets focus back on the way out.
  useEffect(() => {
    if (!zoom) return;
    focusBack.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setZoom(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // preventScroll: the pinned preview is sticky, but focusing it without this
      // snaps the editor back to the top of the page.
      focusBack.current?.focus?.({ preventScroll: true });
    };
  }, [zoom]);

  // A quick tap on Done or back must not drop the last change before the
  // debounce fires, so flush whatever is still unsaved when leaving.
  useEffect(
    () => () => {
      const serialized = JSON.stringify(latest.current);
      if (serialized === lastSaved.current) return;
      lastSaved.current = serialized;
      void fetch(`/api/invitations/${latest.current.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: serialized,
        keepalive: true,
      });
    },
    [],
  );

  const update = (mutate: (draft: Invitation) => void) =>
    setInv((prev) => {
      const next = structuredClone(prev);
      mutate(next);
      return next;
    });

  function applyDesign(slug: string) {
    update((draft) => {
      const design = getDesign(slug);
      const thin = new Set(['Hosts', 'Venue']);
      draft.designSlug = design.slug;
      const portrait = draft.card.portrait ?? null;
      const portraitX = draft.card.portraitX;
      const portraitY = draft.card.portraitY;
      draft.card = {
        ...defaultCard(design),
        portrait,
        portraitX,
        portraitY,
        layers: draft.card.layers.map((layer) => ({
          ...layer,
          color: design.card.ink,
          font: thin.has(layer.name) ? design.heading : design.body,
        })),
      };
      draft.envelope = {
        ...defaultEnvelope(design),
        enabled: draft.envelope.enabled,
        openAnimation: draft.envelope.openAnimation ?? 'classic',
        returnAddress: draft.envelope.returnAddress,
      };
      draft.backdrop = defaultBackdrop(design);
      draft.page = {
        background: design.page.background,
        text: design.page.text,
        accent: design.page.accent,
        fontBody: design.body,
        fontHeading: design.heading,
      };
    });
  }

  function setInk(color: string) {
    update((draft) => {
      draft.card.ink = color;
      draft.card.layers.forEach((layer) => {
        layer.color = color;
      });
      draft.page.text = color;
    });
  }

  return (
    <main className="m-page">
      <Link href={`/app/i/${inv.id}`} className="m-back">
        ‹ Invitation
      </Link>

      <header className="m-head">
        <p className="m-eyebrow">Card editor</p>
        <h1 className="m-title">Edit the card</h1>
        <p className="m-sub">Changes save as you type.</p>
      </header>

      {/* The card stays pinned while you edit, so the change is always in view. */}
      <div className="m-edit-bar">
        <button
          type="button"
          className="m-edit-thumb"
          onClick={() => setZoom(true)}
          aria-label="Enlarge the card preview"
        >
          <InvitationCard inv={inv} />
        </button>
        <div className="m-edit-bar-side">
          <span className={`m-edit-live is-${status}`}>
            {status === 'saved' ? 'Live preview' : status === 'saving' ? 'Saving…' : 'Not saved'}
          </span>
          <div className="m-edit-chips">
            <button type="button" className="m-edit-chip" onClick={() => jumpTo(titlesRef)}>
              Titles
            </button>
            <button type="button" className="m-edit-chip" onClick={() => jumpTo(wordsRef)}>
              Words
            </button>
            <button type="button" className="m-edit-chip" onClick={() => jumpTo(designRef)}>
              Design
            </button>
            <button type="button" className="m-edit-chip" onClick={() => jumpTo(inkRef)}>
              Ink
            </button>
            <button type="button" className="m-edit-chip" onClick={() => jumpTo(eventRef)}>
              Event
            </button>
          </div>
        </div>
      </div>

      <section className="m-panel m-edit-section" ref={titlesRef}>
        <h2>Titles</h2>
        <label className="field">
          <span className="field-label">Invitation name</span>
          <input
            className="input"
            value={inv.title}
            onChange={(e) =>
              update((draft) => {
                draft.title = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          <span className="field-label">Event title</span>
          <input
            className="input"
            value={inv.event.title}
            onChange={(e) =>
              update((draft) => {
                draft.event.title = e.target.value;
              })
            }
          />
        </label>
      </section>

      <section className="m-panel m-edit-section" ref={wordsRef}>
        <h2>The words</h2>
        <p>Edit each line as it prints on the card.</p>
        {inv.card.layers.map((layer) => (
          <div className="m-layer-edit" key={layer.id}>
            <span className="m-layer-name">{layer.name}</span>
            <input
              className="input"
              ref={(el) => {
                layerInputs.current[layer.id] = el;
              }}
              value={layer.text}
              onChange={(e) =>
                update((draft) => {
                  const target = draft.card.layers.find((row) => row.id === layer.id);
                  if (target) target.text = e.target.value;
                })
              }
            />
            <div className="m-layer-tools">
              <label className="m-inline-range">
                <span>Size</span>
                <input
                  type="range"
                  min={1.5}
                  max={14}
                  step={0.1}
                  value={layer.size}
                  onChange={(e) =>
                    update((draft) => {
                      const target = draft.card.layers.find((row) => row.id === layer.id);
                      if (target) target.size = Number(e.target.value);
                    })
                  }
                />
              </label>
              <div className="seg">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    className={layer.align === align ? 'is-on' : ''}
                    onClick={() =>
                      update((draft) => {
                        const target = draft.card.layers.find((row) => row.id === layer.id);
                        if (target) target.align = align;
                      })
                    }
                  >
                    {align === 'left' ? 'Left' : align === 'center' ? 'Centre' : 'Right'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() =>
                  update((draft) => {
                    const target = draft.card.layers.find((row) => row.id === layer.id);
                    if (target) target.visible = !target.visible;
                  })
                }
              >
                {layer.visible ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="m-panel m-edit-section" ref={designRef}>
        <h2>Design</h2>
        <p>Restyle the card. Your words and event details are kept.</p>
        <div className="design-grid">
          {DESIGNS.map((design) => (
            <button
              key={design.slug}
              type="button"
              className={`design-chip ${inv.designSlug === design.slug ? 'is-active' : ''}`}
              onClick={() => applyDesign(design.slug)}
            >
              <span
                className="design-swatch"
                style={{
                  background: design.card.background,
                  color: design.card.ink,
                  borderColor: design.card.accent,
                }}
              >
                Aa
              </span>
              <span className="design-name">{design.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="m-panel m-edit-section" ref={inkRef}>
        <h2>Ink</h2>
        <div className="m-colour-row">
          <label className="m-colour">
            <span>Paper</span>
            <input
              type="color"
              value={inv.card.background}
              onChange={(e) =>
                update((draft) => {
                  draft.card.background = e.target.value;
                })
              }
            />
          </label>
          <label className="m-colour">
            <span>Text</span>
            <input type="color" value={inv.card.ink} onChange={(e) => setInk(e.target.value)} />
          </label>
          <label className="m-colour">
            <span>Accent</span>
            <input
              type="color"
              value={inv.card.accent}
              onChange={(e) =>
                update((draft) => {
                  draft.card.accent = e.target.value;
                  draft.card.borderColor = e.target.value;
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="m-panel m-edit-section" ref={eventRef}>
        <h2>The event</h2>
        <label className="field">
          <span className="field-label">Hosts</span>
          <input
            className="input"
            value={inv.event.host}
            onChange={(e) =>
              update((draft) => {
                draft.event.host = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          <span className="field-label">Starts</span>
          <input
            className="input"
            type="datetime-local"
            value={toLocalInput(inv.event.startsAt)}
            onChange={(e) =>
              update((draft) => {
                const date = new Date(e.target.value);
                if (!Number.isNaN(date.getTime())) draft.event.startsAt = date.toISOString();
              })
            }
          />
        </label>
        <label className="field">
          <span className="field-label">Venue</span>
          <input
            className="input"
            value={inv.event.location}
            onChange={(e) =>
              update((draft) => {
                draft.event.location = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          <span className="field-label">Address</span>
          <input
            className="input"
            value={inv.event.address}
            onChange={(e) =>
              update((draft) => {
                draft.event.address = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          <span className="field-label">Note</span>
          <textarea
            className="input textarea"
            rows={3}
            value={inv.event.description}
            onChange={(e) =>
              update((draft) => {
                draft.event.description = e.target.value;
              })
            }
          />
        </label>
      </section>

      <p className="m-note">
        Changes save as you type. Portraits, uploaded photos, envelope artwork and RSVP settings are
        in the full editor.
      </p>

      <button
        type="button"
        className="btn btn-primary"
        onClick={async () => {
          if (JSON.stringify(inv) !== lastSaved.current) await saveNow(inv);
          router.push(`/app/i/${inv.id}`);
        }}
      >
        Done
      </button>

      {zoom ? (
        <div
          ref={dialogRef}
          className="m-edit-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Card preview"
          onClick={() => setZoom(false)}
        >
          <div className="m-edit-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <InvitationCard inv={inv} onLayerClick={jumpToLayer} />
            <p className="m-edit-hint">Tap a line to edit it</p>
            <button
              ref={closeRef}
              type="button"
              className="btn btn-ghost"
              onClick={() => setZoom(false)}
            >
              Close preview
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import BrandMark from './BrandMark';
import InvitationCard from './InvitationCard';
import EnvelopeCard from './EnvelopeCard';
import { DRIFTS } from './CardDrift';
import { normalizeHex } from '@/lib/color';
import { backdropStyle } from '@/lib/backdrop';
import { DESIGNS, defaultBackdrop, defaultCard, defaultEnvelope, getDesign, resolveEnvelope } from '@/lib/designs';
import { newId } from '@/lib/defaults';
import { ENVELOPE_ANIMATIONS, envelopeAnimation } from '@/lib/envelope-animations';
import { FONTS } from '@/lib/fonts';
import { MOTIFS } from '@/lib/motifs';
import type {
  BackdropPattern,
  DriftId,
  EnvelopeAnimation,
  FlapShape,
  PortraitShape,
  Invitation,
  LinerPattern,
  PaperTexture,
  SealStyle,
  TextLayer,
} from '@/lib/types';

const SECTIONS = [
  ['design', 'Design'],
  ['text', 'Text'],
  ['color', 'Colors'],
  ['envelope', 'Envelope'],
  ['backdrop', 'Backdrop'],
  ['details', 'Event details'],
  ['settings', 'RSVPs & guests'],
  ['page', 'Page style'],
  ['blocks', 'Blocks'],
] as const;

type Section = (typeof SECTIONS)[number][0];

const LINERS: { id: LinerPattern; label: string }[] = [
  { id: 'none', label: 'Blank' },
  { id: 'solid', label: 'Solid' },
  { id: 'stripe', label: 'Diagonal stripe' },
  { id: 'dots', label: 'Pin dots' },
  { id: 'scallop', label: 'Scallop' },
  { id: 'bloom', label: 'Sprig' },
];

const STAMPS = [
  { id: 'arch', label: 'Arch' },
  { id: 'bloom', label: 'Bloom' },
  { id: 'deco', label: 'Fan' },
  { id: 'field', label: 'Field' },
  { id: 'initial', label: 'Monogram' },
  { id: 'balloon', label: 'Balloon' },
  { id: 'candle', label: 'Candle' },
  { id: 'star', label: 'Star' },
];

const FLAPS: { id: FlapShape; label: string }[] = [
  { id: 'pointed', label: 'Pointed' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'flat', label: 'Banker (flat)' },
];

const TEXTURES: { id: PaperTexture; label: string }[] = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'laid', label: 'Laid lines' },
  { id: 'grain', label: 'Grain' },
];

const SEALS: { id: SealStyle; label: string }[] = [
  { id: 'none', label: 'No seal' },
  { id: 'monogram', label: 'Monogram' },
  { id: 'rosette', label: 'Rosette' },
];

const BACKDROPS: { id: BackdropPattern; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'paper', label: 'Paper' },
  { id: 'linen', label: 'Linen' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'sunburst', label: 'Sunburst' },
];

const PALETTES: { name: string; bg: string; ink: string; accent: string }[] = [
  { name: 'Ivory & brass', bg: '#fbf7ef', ink: '#2c2620', accent: '#b08d57' },
  { name: 'Sage & fern', bg: '#eef1e7', ink: '#28332a', accent: '#6f8a63' },
  { name: 'Ink & gold', bg: '#141a26', ink: '#f3ead8', accent: '#c9a227' },
  { name: 'Blush & rose', bg: '#f9ece7', ink: '#3a2b2b', accent: '#a86b6b' },
  { name: 'Porcelain & sea', bg: '#ffffff', ink: '#1c2b33', accent: '#4a7c8c' },
  { name: 'Clay & citrus', bg: '#fdf6ee', ink: '#2f2b26', accent: '#e0805c' },
];

const toInput = (value: string) => (value ? value.slice(0, 16) : '');

/** Seats a portrait in the clear strip above the first line of text. */
function seatPortrait(draft: Invitation) {
  const size = draft.card.portraitSize ?? 16;
  const shape = draft.card.portraitShape ?? 'circle';
  const aspect = shape === 'arch' ? 1.16 : shape === 'oval' ? 4 / 3 : 1;
  const height = (size * aspect) / 1.4;
  const topLine =
    draft.card.layers
      .filter((layer) => layer.visible)
      .reduce<number | null>((min, layer) => (min === null || layer.y < min ? layer.y : min), null) ?? 14;
  const hosts = draft.card.layers.find((layer) => layer.name === 'Hosts' && layer.visible);
  draft.card.portraitX = hosts ? Math.round((hosts.x + hosts.width / 2) * 10) / 10 : 50;
  draft.card.portraitY = Math.round(Math.max(topLine - 1 - height / 2, height / 2 + 0.5) * 10) / 10;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="color-field">
      <span className="field-label">{label}</span>
      <div className="color-row">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} colour picker`}
        />
        <input
          className="input mono"
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(normalizeHex(e.target.value))}
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="range-field">
      <span className="range-head">
        <span className="field-label">{label}</span>
        <span className="range-value">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/**
 * A quick look at the blocks the way they print on the guest page, so the
 * words being typed below are never edited blind.
 */
function BlocksPreview({ inv }: { inv: Invitation }) {
  return (
    <aside
      className="blocks-preview"
      style={{
        background: inv.page.background,
        color: inv.page.text,
        fontFamily: inv.page.fontBody,
      }}
      aria-label="Preview of the blocks on the guest page"
    >
      <span className="blocks-preview-label" style={{ color: inv.page.accent }}>
        On the guest page
      </span>
      {inv.blocks.length === 0 ? (
        <p className="blocks-preview-empty">
          No blocks yet. Add a note, a schedule or a link and it appears here.
        </p>
      ) : (
        inv.blocks.map((block) => (
          <section className="blocks-preview-block" key={block.id}>
            <h3 style={{ fontFamily: inv.page.fontHeading }}>{block.title || 'Untitled block'}</h3>
            {block.body
              ? block.body.split('\n').map((line, index) => <p key={index}>{line || '\u00a0'}</p>)
              : null}
            {block.type === 'link' && block.url ? (
              <span className="blocks-preview-link" style={{ color: inv.page.accent }}>
                Visit link →
              </span>
            ) : null}
          </section>
        ))
      )}
    </aside>
  );
}

export default function Editor({ initial }: { initial: Invitation }) {
  const [inv, setInv] = useState<Invitation>(initial);
  const envelopeLook = resolveEnvelope(inv.envelope, inv.designSlug);
  const [section, setSection] = useState<Section>('design');
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.card.layers.find((l) => l.name === 'Hosts')?.id ?? initial.card.layers[0]?.id ?? null,
  );
  const [view, setView] = useState<'card' | 'envelope'>('card');
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const mounted = useRef(false);

  const set = useCallback((mutate: (draft: Invitation) => void) => {
    setInv((prev) => {
      const next = structuredClone(prev);
      mutate(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/invitations/${inv.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(inv),
        });
        setStatus(res.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [inv]);

  const selected = inv.card.layers.find((l) => l.id === selectedId) ?? null;

  const updateLayer = useCallback(
    (id: string, patch: Partial<TextLayer>) => {
      set((draft) => {
        const layer = draft.card.layers.find((l) => l.id === id);
        if (layer) Object.assign(layer, patch);
      });
    },
    [set],
  );

  function addLayer() {
    const id = newId('layer');
    set((draft) => {
      draft.card.layers.push({
        id,
        name: 'New text',
        text: 'New text',
        font: draft.page.fontBody,
        size: 3,
        color: draft.card.ink,
        weight: 400,
        italic: false,
        uppercase: false,
        tracking: 0,
        lineHeight: 1.35,
        align: 'center',
        x: 20,
        y: 48,
        width: 60,
        visible: true,
      });
    });
    setSelectedId(id);
    setSection('text');
  }

  function duplicateLayer() {
    if (!selected) return;
    const id = newId('layer');
    set((draft) => {
      const source = draft.card.layers.find((l) => l.id === selected.id);
      if (source) {
        draft.card.layers.push({
          ...structuredClone(source),
          id,
          name: `${source.name} copy`,
          y: Math.min(source.y + 5, 95),
        });
      }
    });
    setSelectedId(id);
  }

  function removeLayer(id: string) {
    set((draft) => {
      draft.card.layers = draft.card.layers.filter((l) => l.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
  }

  function applyDesign(slug: string) {
    set((draft) => {
      const design = getDesign(slug);
      const thin = new Set(['Hosts', 'Venue']);
      draft.designSlug = design.slug;
      // The portrait photo and its placement survive a restyle; the frame takes the new design's.
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

  function applyPalette(palette: (typeof PALETTES)[number]) {
    set((draft) => {
      draft.card.background = palette.bg;
      draft.card.ink = palette.ink;
      draft.card.accent = palette.accent;
      draft.card.borderColor = palette.accent;
      draft.card.layers.forEach((layer) => {
        layer.color = palette.ink;
      });
      draft.page.background = palette.bg;
      draft.page.text = palette.ink;
      draft.page.accent = palette.accent;
    });
  }

  function onPhoto(file: File | null) {
    if (!file) return;
    if (file.size > 3_500_000) {
      window.alert('Please choose an image under 3.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      set((draft) => {
        draft.card.photo = result;
      });
    };
    reader.readAsDataURL(file);
  }

  function onPortrait(file: File | null) {
    if (!file) return;
    if (file.size > 3_500_000) {
      window.alert('Please choose an image under 3.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      set((draft) => {
        draft.card.portrait = result;
        if (typeof draft.card.portraitX !== 'number') seatPortrait(draft);
      });
    };
    reader.readAsDataURL(file);
  }

  const driftChoice: DriftId | 'none' =
    inv.card.drift === undefined
      ? (getDesign(inv.designSlug).card.drift ?? 'none')
      : (inv.card.drift ?? 'none');

  return (
    <div className="editor-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand">
            <BrandMark />
          </Link>
          <span className="crumb">/</span>
          <input
            className="title-input"
            value={inv.title}
            onChange={(e) =>
              set((draft) => {
                draft.title = e.target.value;
              })
            }
            aria-label="Invitation title"
          />
        </div>
        <div className="topbar-right">
          <span className={`save-state is-${status}`}>
            {status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Not saved'}
          </span>
          <Link className="btn btn-ghost" href={`/host/${inv.id}`}>
            Guests
          </Link>
          <Link className="btn btn-primary" href={`/i/${inv.id}`} target="_blank" rel="noreferrer">
            Preview
          </Link>
        </div>
      </header>

      <div className="editor-body">
        <nav className="editor-nav" aria-label="Customisation sections">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              className={`nav-item ${section === id ? 'is-active' : ''}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="panel">
          {section === 'design' && (
            <div className="panel-body">
              <h2 className="panel-title">Design</h2>
              <p className="panel-note">
                Pick a starting design. Words are kept; colours, artwork and type are restyled.
              </p>
              <div className="design-grid">
                {DESIGNS.map((design) => (
                  <button
                    key={design.slug}
                    className={`design-chip ${inv.designSlug === design.slug ? 'is-active' : ''}`}
                    onClick={() => applyDesign(design.slug)}
                    title={design.blurb}
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

              <Field label="Decorative artwork">
                <select
                  className="input"
                  value={inv.card.motif ?? 'none'}
                  onChange={(e) =>
                    set((draft) => {
                      draft.card.motif = e.target.value === 'none' ? null : e.target.value;
                    })
                  }
                >
                  {MOTIFS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="field">
                <span className="field-label">Card border</span>
                <div className="seg">
                  {(['none', 'rule', 'double', 'frame'] as const).map((border) => (
                    <button
                      key={border}
                      className={inv.card.border === border ? 'is-on' : ''}
                      onClick={() =>
                        set((draft) => {
                          draft.card.border = border;
                        })
                      }
                    >
                      {border === 'none' ? 'None' : border === 'rule' ? 'Rule' : border === 'double' ? 'Double' : 'Frame'}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="Card motion"
                hint="Each design starts with its own motion. Leaves, petals, confetti, glitter or dust — or none at all."
              >
                <select
                  className="input"
                  value={driftChoice}
                  onChange={(e) =>
                    set((draft) => {
                      draft.card.drift = e.target.value === 'none' ? null : (e.target.value as DriftId);
                    })
                  }
                >
                  {DRIFTS.map((motion) => (
                    <option key={motion.id} value={motion.id}>
                      {motion.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="field">
                <span className="field-label">Card photo</span>
                {inv.card.photo ? (
                  <div className="photo-actions">
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                    />
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() =>
                        set((draft) => {
                          draft.card.photo = null;
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                  />
                )}
                {inv.card.photo ? (
                  <Range
                    label="Photo opacity"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={inv.card.photoOpacity}
                    onChange={(value) =>
                      set((draft) => {
                        draft.card.photoOpacity = value;
                      })
                    }
                  />
                ) : null}
              </div>

              <Field
                label="Portrait"
                hint="A photo framed in a shape. Drag it on the card to place it."
              >
                <div className="upload-row">
                  {inv.card.portrait ? (
                    <span
                      className="upload-thumb is-portrait"
                      style={{ backgroundImage: `url(${inv.card.portrait})` }}
                      aria-hidden
                    />
                  ) : null}
                  <label className="btn btn-ghost btn-small upload-pick">
                    {inv.card.portrait ? 'Replace portrait' : 'Choose portrait'}
                    <input
                      className="upload-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        onPortrait(e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {inv.card.portrait ? (
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() =>
                        set((draft) => {
                          draft.card.portrait = null;
                          draft.card.portraitX = undefined;
                          draft.card.portraitY = undefined;
                        })
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                  {typeof inv.card.portraitX === 'number' ? (
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() =>
                        set((draft) => {
                          draft.card.portraitX = undefined;
                          draft.card.portraitY = undefined;
                        })
                      }
                    >
                      Reset position
                    </button>
                  ) : null}
                </div>
              </Field>

              <Field label="Portrait frame">
                <select
                  className="input"
                  value={inv.card.portraitShape ?? 'circle'}
                  onChange={(e) =>
                    set((draft) => {
                      draft.card.portraitShape = e.target.value as PortraitShape;
                      if (typeof draft.card.portraitX !== 'number') seatPortrait(draft);
                    })
                  }
                >
                  {(
                    [
                      ['circle', 'Circle'],
                      ['arch', 'Arch'],
                      ['oval', 'Oval'],
                      ['soft', 'Soft square'],
                    ] as const
                  ).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Range
                label="Portrait size"
                min={8}
                max={46}
                step={1}
                value={inv.card.portraitSize ?? 16}
                onChange={(value) =>
                  set((draft) => {
                    draft.card.portraitSize = value;
                    draft.card.portraitShape = draft.card.portraitShape ?? 'circle';
                    if (typeof draft.card.portraitX !== 'number') seatPortrait(draft);
                  })
                }
                suffix="%"
              />
            </div>
          )}

          {section === 'text' && (
            <div className="panel-body">
              <div className="panel-head">
                <h2 className="panel-title">Text</h2>
                <button className="btn btn-ghost btn-small" onClick={addLayer}>
                  + Add text
                </button>
              </div>
              <p className="panel-note">Click a line to edit it, or drag it straight on the card.</p>

              <div className="layer-list">
                {inv.card.layers.map((layer) => (
                  <div
                    key={layer.id}
                    className={`layer-row ${selectedId === layer.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(layer.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedId(layer.id);
                    }}
                  >
                    <span className="layer-name">{layer.name}</span>
                    <span className="layer-preview">{layer.text.replace(/\n/g, ' ')}</span>
                    <button
                      className="icon-btn"
                      aria-label={layer.visible ? 'Hide line' : 'Show line'}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                    >
                      {layer.visible ? '●' : '○'}
                    </button>
                  </div>
                ))}
              </div>

              {selected ? (
                <div className="inspector">
                  <Field label="Line name">
                    <input
                      className="input"
                      value={selected.name}
                      onChange={(e) => updateLayer(selected.id, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Words">
                    <textarea
                      className="input textarea"
                      rows={3}
                      value={selected.text}
                      onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                    />
                  </Field>
                  <Field label="Font">
                    <select
                      className="input"
                      style={{ fontFamily: selected.font }}
                      value={selected.font}
                      onChange={(e) => updateLayer(selected.id, { font: e.target.value })}
                    >
                      {FONTS.map((font) => (
                        <option key={font.label} value={font.stack} style={{ fontFamily: font.stack }}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Range
                    label="Size"
                    min={1.4}
                    max={16}
                    step={0.1}
                    value={selected.size}
                    onChange={(value) => updateLayer(selected.id, { size: value })}
                  />
                  <div className="field">
                    <span className="field-label">Style</span>
                    <div className="seg seg-wrap">
                      {[300, 400, 500, 600, 700].map((weight) => (
                        <button
                          key={weight}
                          className={selected.weight === weight ? 'is-on' : ''}
                          onClick={() => updateLayer(selected.id, { weight })}
                        >
                          {weight}
                        </button>
                      ))}
                    </div>
                    <div className="seg seg-wrap">
                      <button
                        className={selected.italic ? 'is-on' : ''}
                        onClick={() => updateLayer(selected.id, { italic: !selected.italic })}
                      >
                        Italic
                      </button>
                      <button
                        className={selected.uppercase ? 'is-on' : ''}
                        onClick={() => updateLayer(selected.id, { uppercase: !selected.uppercase })}
                      >
                        Caps
                      </button>
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          className={selected.align === align ? 'is-on' : ''}
                          onClick={() => updateLayer(selected.id, { align })}
                        >
                          {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Range
                    label="Letter spacing"
                    min={-0.05}
                    max={0.6}
                    step={0.01}
                    value={selected.tracking}
                    onChange={(value) => updateLayer(selected.id, { tracking: value })}
                  />
                  <Range
                    label="Line height"
                    min={0.85}
                    max={2.2}
                    step={0.01}
                    value={selected.lineHeight}
                    onChange={(value) => updateLayer(selected.id, { lineHeight: value })}
                  />
                  <ColorInput
                    label="Text colour"
                    value={selected.color}
                    onChange={(value) => updateLayer(selected.id, { color: value })}
                  />
                  <div className="grid-2">
                    <Range
                      label="X"
                      min={-20}
                      max={95}
                      step={0.5}
                      value={selected.x}
                      suffix="%"
                      onChange={(value) => updateLayer(selected.id, { x: value })}
                    />
                    <Range
                      label="Y"
                      min={0}
                      max={98}
                      step={0.5}
                      value={selected.y}
                      suffix="%"
                      onChange={(value) => updateLayer(selected.id, { y: value })}
                    />
                  </div>
                  <Range
                    label="Width"
                    min={20}
                    max={100}
                    step={1}
                    value={selected.width}
                    suffix="%"
                    onChange={(value) => updateLayer(selected.id, { width: value })}
                  />
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-small" onClick={duplicateLayer}>
                      Duplicate
                    </button>
                    <button className="btn btn-danger btn-small" onClick={() => removeLayer(selected.id)}>
                      Delete line
                    </button>
                  </div>
                </div>
              ) : (
                <p className="panel-note">Select a line to edit it.</p>
              )}
            </div>
          )}

          {section === 'color' && (
            <div className="panel-body">
              <h2 className="panel-title">Colors</h2>
              <p className="panel-note">Apply a palette, then fine-tune any value by hex code.</p>
              <div className="palette-grid">
                {PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    className="palette-chip"
                    onClick={() => applyPalette(palette)}
                    title={palette.name}
                  >
                    <span style={{ background: palette.bg }} />
                    <span style={{ background: palette.ink }} />
                    <span style={{ background: palette.accent }} />
                  </button>
                ))}
              </div>
              <ColorInput
                label="Card background"
                value={inv.card.background}
                onChange={(value) =>
                  set((draft) => {
                    draft.card.background = value;
                  })
                }
              />
              <ColorInput
                label="Ink (all text)"
                value={inv.card.ink}
                onChange={(value) =>
                  set((draft) => {
                    draft.card.ink = value;
                    draft.card.layers.forEach((layer) => {
                      layer.color = value;
                    });
                  })
                }
              />
              <ColorInput
                label="Accent artwork"
                value={inv.card.accent}
                onChange={(value) =>
                  set((draft) => {
                    draft.card.accent = value;
                  })
                }
              />
              <ColorInput
                label="Border"
                value={inv.card.borderColor}
                onChange={(value) =>
                  set((draft) => {
                    draft.card.borderColor = value;
                  })
                }
              />
            </div>
          )}

          {section === 'envelope' && (
            <div className="panel-body">
              <h2 className="panel-title">Envelope</h2>
              <p className="panel-note">
                Each guest sees their own name on the front. The flap opens before the card is revealed.
              </p>
              <Toggle
                label="Send in an envelope"
                hint="Turn off to link straight to the card."
                checked={inv.envelope.enabled}
                onChange={(checked) =>
                  set((draft) => {
                    draft.envelope.enabled = checked;
                  })
                }
              />
              <Field
                label="Opening animation"
                hint={envelopeAnimation(envelopeLook.openAnimation).blurb}
              >
                <select
                  className="input"
                  value={envelopeLook.openAnimation}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.openAnimation = e.target.value as EnvelopeAnimation;
                    })
                  }
                >
                  {ENVELOPE_ANIMATIONS.map((animation) => (
                    <option key={animation.id} value={animation.id}>
                      {animation.label}
                    </option>
                  ))}
                </select>
              </Field>
              <ColorInput
                label="Envelope colour"
                value={inv.envelope.color}
                onChange={(value) =>
                  set((draft) => {
                    draft.envelope.color = value;
                  })
                }
              />
              <Field label="Flap shape" hint="How the closing flap is cut.">
                <select
                  className="input"
                  value={envelopeLook.flap}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.flap = e.target.value as FlapShape;
                    })
                  }
                >
                  {FLAPS.map((flap) => (
                    <option key={flap.id} value={flap.id}>
                      {flap.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Paper texture" hint="Printed onto the stock, folds and all.">
                <select
                  className="input"
                  value={envelopeLook.texture}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.texture = e.target.value as PaperTexture;
                    })
                  }
                >
                  {TEXTURES.map((texture) => (
                    <option key={texture.id} value={texture.id}>
                      {texture.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Wax seal" hint="Pressed over the flap tip, with the host's initial.">
                <select
                  className="input"
                  value={envelopeLook.seal}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.seal = e.target.value as SealStyle;
                    })
                  }
                >
                  {SEALS.map((seal) => (
                    <option key={seal.id} value={seal.id}>
                      {seal.label}
                    </option>
                  ))}
                </select>
              </Field>
              {envelopeLook.seal !== 'none' ? (
                <ColorInput
                  label="Seal wax"
                  value={envelopeLook.sealColor}
                  onChange={(value) =>
                    set((draft) => {
                      draft.envelope.sealColor = value;
                    })
                  }
                />
              ) : null}
              <Field label="Liner pattern">
                <select
                  className="input"
                  value={inv.envelope.linerPattern}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.linerPattern = e.target.value as LinerPattern;
                    })
                  }
                >
                  {LINERS.map((liner) => (
                    <option key={liner.id} value={liner.id}>
                      {liner.label}
                    </option>
                  ))}
                </select>
              </Field>
              <ColorInput
                label="Liner base"
                value={inv.envelope.linerColor}
                onChange={(value) =>
                  set((draft) => {
                    draft.envelope.linerColor = value;
                  })
                }
              />
              <ColorInput
                label="Liner motif"
                value={inv.envelope.linerColor2}
                onChange={(value) =>
                  set((draft) => {
                    draft.envelope.linerColor2 = value;
                  })
                }
              />
              <Field label="Stamp">
                <select
                  className="input"
                  value={inv.envelope.stamp}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.stamp = e.target.value;
                    })
                  }
                >
                  {STAMPS.map((stamp) => (
                    <option key={stamp.id} value={stamp.id}>
                      {stamp.label}
                    </option>
                  ))}
                </select>
              </Field>
              <ColorInput
                label="Stamp ink"
                value={inv.envelope.stampColor}
                onChange={(value) =>
                  set((draft) => {
                    draft.envelope.stampColor = value;
                  })
                }
              />
              <Field label="Envelope font">
                <select
                  className="input"
                  value={inv.envelope.font}
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.font = e.target.value;
                    })
                  }
                >
                  {FONTS.map((font) => (
                    <option key={font.label} value={font.stack}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Return address" hint="Printed small on the front of the envelope.">
                <input
                  className="input"
                  value={inv.envelope.returnAddress}
                  placeholder="The Old Fig House, Hudson NY"
                  onChange={(e) =>
                    set((draft) => {
                      draft.envelope.returnAddress = e.target.value;
                    })
                  }
                />
              </Field>
            </div>
          )}

          {section === 'backdrop' && (
            <div className="panel-body">
              <h2 className="panel-title">Backdrop</h2>
              <p className="panel-note">The surface behind the card when a guest opens the link.</p>
              <Field label="Pattern">
                <select
                  className="input"
                  value={inv.backdrop.pattern}
                  onChange={(e) =>
                    set((draft) => {
                      draft.backdrop.pattern = e.target.value as BackdropPattern;
                    })
                  }
                >
                  {BACKDROPS.map((backdrop) => (
                    <option key={backdrop.id} value={backdrop.id}>
                      {backdrop.label}
                    </option>
                  ))}
                </select>
              </Field>
              <ColorInput
                label="Base colour"
                value={inv.backdrop.color1}
                onChange={(value) =>
                  set((draft) => {
                    draft.backdrop.color1 = value;
                  })
                }
              />
              <ColorInput
                label="Second colour"
                value={inv.backdrop.color2}
                onChange={(value) =>
                  set((draft) => {
                    draft.backdrop.color2 = value;
                  })
                }
              />
              <Field
                label="Upload your own"
                hint="PNG, JPEG or WebP up to 3.5 MB. Replaces the pattern behind the card."
              >
                <div className="upload-row">
                  {inv.backdrop.image ? (
                    <span
                      className="upload-thumb"
                      style={{ backgroundImage: `url(${inv.backdrop.image})` }}
                      aria-hidden
                    />
                  ) : null}
                  <label className="btn btn-ghost btn-small upload-pick">
                    {inv.backdrop.image ? 'Replace image' : 'Choose image'}
                    <input
                      className="upload-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 3_500_000) {
                          window.alert('Please choose an image under 3.5 MB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = String(reader.result);
                          set((draft) => {
                            draft.backdrop.image = result;
                          });
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {inv.backdrop.image ? (
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() =>
                        set((draft) => {
                          draft.backdrop.image = null;
                        })
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </Field>
            </div>
          )}

          {section === 'details' && (
            <div className="panel-body">
              <h2 className="panel-title">Event details</h2>
              <p className="panel-note">These power the guest page, calendar file and reminders.</p>
              <Field label="Mailing subject">
                <input
                  className="input"
                  value={inv.subject}
                  onChange={(e) =>
                    set((draft) => {
                      draft.subject = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Event title">
                <input
                  className="input"
                  value={inv.event.title}
                  onChange={(e) =>
                    set((draft) => {
                      draft.event.title = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Host names">
                <input
                  className="input"
                  value={inv.event.host}
                  onChange={(e) =>
                    set((draft) => {
                      draft.event.host = e.target.value;
                    })
                  }
                />
              </Field>
              <div className="grid-2">
                <Field label="Starts">
                  <input
                    className="input"
                    type="datetime-local"
                    value={toInput(inv.event.startsAt)}
                    onChange={(e) =>
                      set((draft) => {
                        draft.event.startsAt = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Ends">
                  <input
                    className="input"
                    type="datetime-local"
                    value={toInput(inv.event.endsAt)}
                    onChange={(e) =>
                      set((draft) => {
                        draft.event.endsAt = e.target.value;
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Venue">
                <input
                  className="input"
                  value={inv.event.location}
                  onChange={(e) =>
                    set((draft) => {
                      draft.event.location = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Address">
                <input
                  className="input"
                  value={inv.event.address}
                  onChange={(e) =>
                    set((draft) => {
                      draft.event.address = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Description">
                <textarea
                  className="input textarea"
                  rows={4}
                  value={inv.event.description}
                  onChange={(e) =>
                    set((draft) => {
                      draft.event.description = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Dress code">
                <input
                  className="input"
                  value={inv.event.dressCode}
                  onChange={(e) =>
                    set((draft) => {
                      draft.event.dressCode = e.target.value;
                    })
                  }
                />
              </Field>
            </div>
          )}

          {section === 'settings' && (
            <div className="panel-body">
              <h2 className="panel-title">RSVPs &amp; guest list</h2>
              <Toggle
                label="Collect RSVPs"
                checked={inv.settings.collectRsvp}
                onChange={(checked) =>
                  set((draft) => {
                    draft.settings.collectRsvp = checked;
                  })
                }
              />
              <Toggle
                label="Show who's coming publicly"
                checked={inv.settings.showGuestList}
                onChange={(checked) =>
                  set((draft) => {
                    draft.settings.showGuestList = checked;
                  })
                }
              />
              <Toggle
                label="Allow additional guests"
                checked={inv.settings.allowPlusOnes}
                onChange={(checked) =>
                  set((draft) => {
                    draft.settings.allowPlusOnes = checked;
                  })
                }
              />
              {inv.settings.allowPlusOnes ? (
                <Field label="Maximum additional guests">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={10}
                    value={inv.settings.maxPlusOnes}
                    onChange={(e) =>
                      set((draft) => {
                        draft.settings.maxPlusOnes = Math.max(1, Number(e.target.value) || 1);
                      })
                    }
                  />
                </Field>
              ) : null}
              <Toggle
                label="Collect adults and children separately"
                checked={inv.settings.headcount}
                onChange={(checked) =>
                  set((draft) => {
                    draft.settings.headcount = checked;
                  })
                }
              />
              <Toggle
                label="Ask for a mobile number"
                checked={inv.settings.textUpdates !== false}
                onChange={(checked) =>
                  set((draft) => {
                    draft.settings.textUpdates = checked;
                  })
                }
              />
              {inv.settings.textUpdates !== false ? (
                <p className="panel-note">
                  Guests can leave a mobile number and opt in to text updates when they reply. Only
                  numbers with a tick appear in the text list.
                </p>
              ) : null}
              <Field label="Capacity" hint="Leave blank for no limit.">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={inv.settings.capacity ?? ''}
                  onChange={(e) =>
                    set((draft) => {
                      draft.settings.capacity = e.target.value ? Number(e.target.value) : null;
                    })
                  }
                />
              </Field>
              <Field label="RSVP deadline">
                <input
                  className="input"
                  type="datetime-local"
                  value={toInput(inv.settings.deadline ?? '')}
                  onChange={(e) =>
                    set((draft) => {
                      draft.settings.deadline = e.target.value || null;
                    })
                  }
                />
              </Field>

              <div className="panel-head">
                <span className="field-label">Guest questions</span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() =>
                    set((draft) => {
                      draft.settings.questions.push({
                        id: newId('q'),
                        label: 'New question',
                        type: 'text',
                        options: [],
                        required: false,
                      });
                    })
                  }
                >
                  + Add
                </button>
              </div>
              {inv.settings.questions.map((question) => (
                <div className="question-card" key={question.id}>
                  <input
                    className="input"
                    value={question.label}
                    onChange={(e) =>
                      set((draft) => {
                        const target = draft.settings.questions.find((q) => q.id === question.id);
                        if (target) target.label = e.target.value;
                      })
                    }
                  />
                  <div className="row-actions">
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) =>
                          set((draft) => {
                            const target = draft.settings.questions.find((q) => q.id === question.id);
                            if (target) target.required = e.target.checked;
                          })
                        }
                      />
                      Required
                    </label>
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() =>
                        set((draft) => {
                          draft.settings.questions = draft.settings.questions.filter(
                            (q) => q.id !== question.id,
                          );
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'page' && (
            <div className="panel-body">
              <h2 className="panel-title">Page style</h2>
              <p className="panel-note">How the guest page reads after the card is opened.</p>
              <ColorInput
                label="Page background"
                value={inv.page.background}
                onChange={(value) =>
                  set((draft) => {
                    draft.page.background = value;
                  })
                }
              />
              <ColorInput
                label="Page text"
                value={inv.page.text}
                onChange={(value) =>
                  set((draft) => {
                    draft.page.text = value;
                  })
                }
              />
              <ColorInput
                label="Page accent"
                value={inv.page.accent}
                onChange={(value) =>
                  set((draft) => {
                    draft.page.accent = value;
                  })
                }
              />
              <Field label="Heading font">
                <select
                  className="input"
                  value={inv.page.fontHeading}
                  onChange={(e) =>
                    set((draft) => {
                      draft.page.fontHeading = e.target.value;
                    })
                  }
                >
                  {FONTS.map((font) => (
                    <option key={font.label} value={font.stack}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Body font">
                <select
                  className="input"
                  value={inv.page.fontBody}
                  onChange={(e) =>
                    set((draft) => {
                      draft.page.fontBody = e.target.value;
                    })
                  }
                >
                  {FONTS.map((font) => (
                    <option key={font.label} value={font.stack}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {section === 'blocks' && (
            <div className="panel-body">
              <h2 className="panel-title">Blocks</h2>
              <p className="panel-note">Extra sections on the guest page: schedule, notes, links.</p>
              {inv.blocks.map((block) => (
                <div className="block-card" key={block.id}>
                  <div className="grid-2">
                    <Field label="Type">
                      <select
                        className="input"
                        value={block.type}
                        onChange={(e) =>
                          set((draft) => {
                            const target = draft.blocks.find((b) => b.id === block.id);
                            if (target) target.type = e.target.value as typeof block.type;
                          })
                        }
                      >
                        <option value="note">Note</option>
                        <option value="schedule">Schedule</option>
                        <option value="link">Link</option>
                      </select>
                    </Field>
                    <Field label="Title">
                      <input
                        className="input"
                        value={block.title}
                        onChange={(e) =>
                          set((draft) => {
                            const target = draft.blocks.find((b) => b.id === block.id);
                            if (target) target.title = e.target.value;
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Body" hint="One line per schedule entry.">
                    <textarea
                      className="input textarea"
                      rows={3}
                      value={block.body}
                      onChange={(e) =>
                        set((draft) => {
                          const target = draft.blocks.find((b) => b.id === block.id);
                          if (target) target.body = e.target.value;
                        })
                      }
                    />
                  </Field>
                  {block.type === 'link' ? (
                    <Field label="Link">
                      <input
                        className="input"
                        value={block.url}
                        placeholder="https://"
                        onChange={(e) =>
                          set((draft) => {
                            const target = draft.blocks.find((b) => b.id === block.id);
                            if (target) target.url = e.target.value;
                          })
                        }
                      />
                    </Field>
                  ) : null}
                  <button
                    className="btn btn-ghost btn-small"
                    onClick={() =>
                      set((draft) => {
                        draft.blocks = draft.blocks.filter((b) => b.id !== block.id);
                      })
                    }
                  >
                    Remove block
                  </button>
                </div>
              ))}
              <div className="row-actions">
                {(['note', 'schedule', 'link'] as const).map((type) => (
                  <button
                    key={type}
                    className="btn btn-ghost btn-small"
                    onClick={() =>
                      set((draft) => {
                        draft.blocks.push({
                          id: newId('block'),
                          type,
                          title: type === 'note' ? 'A note' : type === 'schedule' ? 'Schedule' : 'A link',
                          body: '',
                          url: '',
                        });
                      })
                    }
                  >
                    + {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <main className="stage">
          <div className="stage-tools">
            <div className="seg">
              <button className={view === 'card' ? 'is-on' : ''} onClick={() => setView('card')}>
                Card
              </button>
              <button
                className={view === 'envelope' ? 'is-on' : ''}
                onClick={() => setView('envelope')}
                disabled={!inv.envelope.enabled}
              >
                Envelope
              </button>
            </div>
            <span className="stage-hint">
              {view === 'card'
                ? section === 'blocks'
                  ? 'Blocks print below the details on the guest page'
                  : 'Drag any line to move it'
                : 'Guest names fill in on send'}
            </span>
          </div>
          <div
            className={`stage-canvas ${view === 'envelope' ? 'is-envelope' : ''}`}
            style={backdropStyle(inv.backdrop)}
          >
            {view === 'card' ? (
              <div className={section === 'blocks' ? 'stage-duo' : 'stage-solo'}>
                <InvitationCard
                  inv={inv}
                  editable
                  selectedLayerId={selectedId}
                  onSelectLayer={setSelectedId}
                  onLayerChange={updateLayer}
                  onPortraitMove={(x, y) =>
                    set((draft) => {
                      draft.card.portraitX = x;
                      draft.card.portraitY = y;
                    })
                  }
                />
                {section === 'blocks' ? <BlocksPreview inv={inv} /> : null}
              </div>
            ) : (
              <EnvelopeCard
                envelope={inv.envelope}
                designSlug={inv.designSlug}
                guestName={inv.event.host}
                monogram={inv.event.host}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

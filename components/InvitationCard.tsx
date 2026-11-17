'use client';

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import CardDrift from './CardDrift';
import { getDesign } from '@/lib/designs';
import { Motif } from '@/lib/motifs';
import type { Invitation, TextLayer } from '@/lib/types';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number) => Math.round(n * 10) / 10;

type Props = {
  inv: Invitation;
  editable?: boolean;
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string) => void;
  onLayerChange?: (id: string, patch: Partial<TextLayer>) => void;
  onPortraitMove?: (x: number, y: number) => void;
  onPortraitClick?: () => void;
  onLayerClick?: (id: string) => void;
  onPhotoClick?: () => void;
  onCardClick?: () => void;
  className?: string;
  /** Show the centre crosshair while a line is being dragged, and snap to it. */
  guides?: boolean;
};

const borderStyles: Record<string, CSSProperties> = {
  none: {},
  rule: { boxShadow: 'inset 0 0 0 1px var(--card-border)' },
  double: { boxShadow: 'inset 0 0 0 1px var(--card-border), inset 0 0 0 4px transparent, inset 0 0 0 5px var(--card-border)' },
  frame: { boxShadow: 'inset 0 0 0 12px var(--card-bg), inset 0 0 0 13px var(--card-border), inset 0 0 0 22px var(--card-bg), inset 0 0 0 23px var(--card-border)' },
};

export default function InvitationCard({
  inv,
  editable = false,
  selectedLayerId = null,
  onSelectLayer,
  onLayerChange,
  onPortraitMove,
  onPortraitClick,
  onLayerClick,
  onPhotoClick,
  onCardClick,
  className = '',
  guides = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [guide, setGuide] = useState<{ v: boolean; h: boolean } | null>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
    layerW: number;
    layerH: number;
  } | null>(null);

  const { card } = inv;
  // Invitations saved before motion existed have no `drift`: give them their design's.
  const drift = card.drift === undefined ? getDesign(inv.designSlug).card.drift : card.drift;
  // The portrait sits directly above the hosts line, so it inherits that line's column.
  const hosts =
    card.layers.find((l) => l.name === 'Hosts' && l.visible) ??
    card.layers.find((l) => l.visible) ??
    null;
  const portraitShape = card.portraitShape ?? 'circle';
  const portraitSize = card.portraitSize ?? 20;
  // Frame height in card-height %, from the width in cqw (cards are 1.4× as tall as wide).
  const portraitAspect = portraitShape === 'arch' ? 1.16 : portraitShape === 'oval' ? 4 / 3 : 1;
  const placed = typeof card.portraitX === 'number' && typeof card.portraitY === 'number';
  const topLine = card.layers.filter((l) => l.visible).reduce<number | null>(
    (min, l) => (min === null || l.y < min ? l.y : min),
    null,
  );
  // Until the host places it, the frame is drawn at whatever size fits above the first line.
  const fitSize = Math.max(6, (((topLine ?? 14) - 2) * 1.4) / portraitAspect);
  const drawnSize = placed ? portraitSize : Math.min(portraitSize, fitSize);
  const portraitHeight = (drawnSize * portraitAspect) / 1.4;
  const portraitLeft = placed
    ? card.portraitX!
    : hosts
      ? hosts.x + hosts.width / 2
      : 50;
  // An unplaced frame sits in the clear strip above the topmost line.
  const portraitTop = placed
    ? card.portraitY!
    : Math.max((topLine ?? 14) - 1 - portraitHeight / 2, portraitHeight / 2 + 0.5);

  function beginDrag(e: ReactPointerEvent<HTMLDivElement>, layer: TextLayer) {
    if (!editable || !onLayerChange) return;
    onSelectLayer?.(layer.id);
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    const layerRect = e.currentTarget.getBoundingClientRect();
    drag.current = {
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      x: layer.x,
      y: layer.y,
      w: rect.width,
      h: rect.height,
      layerW: (layerRect.width / rect.width) * 100,
      layerH: (layerRect.height / rect.height) * 100,
    };
    let dragged = false;
    const move = (ev: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      // A plain click selects the line; only a real drag nudges it.
      if (!dragged && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 3) return;
      dragged = true;
      const dx = ((ev.clientX - d.startX) / d.w) * 100;
      const dy = ((ev.clientY - d.startY) / d.h) * 100;
      let x = clamp(round(d.x + dx), -30, 100);
      let y = clamp(round(d.y + dy), -5, 99);

      // Centre guides: when a line's own centre comes near the card's centre,
      // pull it the last few tenths of a percent and flag the guide as snapped.
      const snapDistance = 1.8;
      const centredX = Math.abs(x + d.layerW / 2 - 50) <= snapDistance;
      const centredY = Math.abs(y + d.layerH / 2 - 50) <= snapDistance;
      if (guides && centredX) x = clamp(round(50 - d.layerW / 2), -30, 100);
      if (guides && centredY) y = clamp(round(50 - d.layerH / 2), -5, 99);
      setGuide(guides ? { v: centredX, h: centredY } : null);

      onLayerChange(d.id, { x, y });
    };
    const up = () => {
      drag.current = null;
      setGuide(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const style: CSSProperties = {
    background: card.background,
    color: card.ink,
    ['--card-border' as string]: card.borderColor,
    ['--card-bg' as string]: card.background,
    ...borderStyles[card.border],
  };

  function beginPortraitDrag(e: ReactPointerEvent<HTMLSpanElement>) {
    if (!editable || !onPortraitMove) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragged = false;
    const place = (cx: number, cy: number) => {
      let x = clamp(round(((cx - rect.left) / rect.width) * 100), 0, 100);
      let y = clamp(round(((cy - rect.top) / rect.height) * 100), 0, 100);
      // The portrait is placed by its centre, so the card's centre is 50% on
      // both axes. Snap it just like a text line, with the same guides.
      const snapDistance = 1.8;
      const centredX = guides && Math.abs(x - 50) <= snapDistance;
      const centredY = guides && Math.abs(y - 50) <= snapDistance;
      if (centredX) x = 50;
      if (centredY) y = 50;
      setGuide(guides ? { v: centredX, h: centredY } : null);
      onPortraitMove(x, y);
    };
    const move = (ev: globalThis.PointerEvent) => {
      // A plain click keeps the portrait where it is; only a real drag moves it.
      if (!dragged && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      dragged = true;
      place(ev.clientX, ev.clientY);
    };
    const up = () => {
      drag.current = null;
      setGuide(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div
      ref={cardRef}
      className={`inv-card ${className}`}
      style={style}
      data-editable={editable || undefined}
      onClick={(e) => {
        // Only clicks on the paper itself; text lines and the portrait stop their own.
        if (e.target === e.currentTarget) onCardClick?.();
      }}
    >
      {card.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.photo}
          alt=""
          className="inv-photo"
          style={{ opacity: card.photoOpacity }}
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            onPhotoClick?.();
          }}
        />
      ) : null}

      {card.portrait && hosts ? (
        <span
          className={`inv-portrait${placed ? ' is-placed' : ''}`}
          data-shape={portraitShape}
          onPointerDown={beginPortraitDrag}
          onClick={(e) => {
            e.stopPropagation();
            onPortraitClick?.();
          }}
          style={{
            left: `${portraitLeft}%`,
            top: `${portraitTop}%`,
            width: `${drawnSize}cqw`,
            ['--portrait-ring' as string]: card.accent,
            ['--portrait-paper' as string]: card.background,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.portrait} alt="" draggable={false} />
        </span>
      ) : null}

      {card.motif ? <Motif id={card.motif} ink={card.ink} accent={card.accent} /> : null}

      <CardDrift kind={drift} ink={card.ink} accent={card.accent} />

      {editable && guides ? (
        <div
          className={`inv-guides${guide ? ' is-dragging' : ''}`}
          style={{ pointerEvents: 'none' }}
          aria-hidden
        >
          <span className={`inv-guide is-v${guide?.v ? ' is-snapped' : ''}`} />
          <span className={`inv-guide is-h${guide?.h ? ' is-snapped' : ''}`} />
        </div>
      ) : null}

      {card.layers
        .filter((l) => l.visible)
        .map((layer) => (
          <div
            key={layer.id}
            className={[
              'inv-layer',
              editable ? 'is-editable' : '',
              selectedLayerId === layer.id ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={(e) => beginDrag(e, layer)}
            onClick={(e) => {
              e.stopPropagation();
              onLayerClick?.(layer.id);
            }}
            style={{
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              width: `${layer.width}%`,
              textAlign: layer.align,
              fontFamily: layer.font,
              fontSize: `${layer.size}cqw`,
              color: layer.color,
              fontWeight: layer.weight,
              fontStyle: layer.italic ? 'italic' : 'normal',
              letterSpacing: `${layer.tracking}em`,
              lineHeight: layer.lineHeight,
              textTransform: layer.uppercase ? 'uppercase' : 'none',
            }}
          >
            {layer.text}
          </div>
        ))}
    </div>
  );
}

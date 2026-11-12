'use client';

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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
  className?: string;
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
  className = '',
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
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
    drag.current = {
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      x: layer.x,
      y: layer.y,
      w: rect.width,
      h: rect.height,
    };
    const move = (ev: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ((ev.clientX - d.startX) / d.w) * 100;
      const dy = ((ev.clientY - d.startY) / d.h) * 100;
      onLayerChange(d.id, {
        x: clamp(round(d.x + dx), -30, 100),
        y: clamp(round(d.y + dy), -5, 99),
      });
    };
    const up = () => {
      drag.current = null;
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
    e.preventDefault();
    onPortraitMove(
      clamp(round(((e.clientX - rect.left) / rect.width) * 100), 0, 100),
      clamp(round(((e.clientY - rect.top) / rect.height) * 100), 0, 100),
    );
    const move = (ev: globalThis.PointerEvent) => {
      onPortraitMove(
        clamp(round(((ev.clientX - rect.left) / rect.width) * 100), 0, 100),
        clamp(round(((ev.clientY - rect.top) / rect.height) * 100), 0, 100),
      );
    };
    const up = () => {
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
    >
      {card.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.photo}
          alt=""
          className="inv-photo"
          style={{ opacity: card.photoOpacity }}
          draggable={false}
        />
      ) : null}

      {card.portrait && hosts ? (
        <span
          className={`inv-portrait${placed ? ' is-placed' : ''}`}
          data-shape={portraitShape}
          onPointerDown={beginPortraitDrag}
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

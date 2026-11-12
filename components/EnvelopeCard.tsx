'use client';

import type { CSSProperties, ReactNode } from 'react';
import { normalizeHex, readableOn, shade, withAlpha } from '@/lib/color';
import { resolveEnvelope } from '@/lib/designs';
import type { Envelope, FlapShape } from '@/lib/types';

/** Soft crease shadows along each flap silhouette, in a 100×100 envelope box. */
const FOLD_PATHS: Record<FlapShape, string> = {
  pointed: 'M0 1 L50 64 M100 1 L50 64',
  rounded: 'M0 1 L46 58 Q50 61.5 54 58 L100 1',
  flat: 'M0 48 L50 56 L100 48',
};

function linerStyle(env: Envelope): CSSProperties {
  const a = normalizeHex(env.linerColor);
  const b = normalizeHex(env.linerColor2);
  const base: CSSProperties = { background: a };
  switch (env.linerPattern) {
    case 'stripe':
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(45deg, ${a} 0 14px, ${b} 14px 22px)`,
      };
    case 'dots':
      return {
        ...base,
        backgroundImage: `radial-gradient(${b} 2px, transparent 2.4px)`,
        backgroundSize: '18px 18px',
      };
    case 'scallop':
      return {
        ...base,
        backgroundColor: b,
        backgroundImage: `radial-gradient(circle at 50% 0, ${a} 0 12px, transparent 12.5px), radial-gradient(circle at 0 50%, ${a} 0 12px, transparent 12.5px), radial-gradient(circle at 100% 50%, ${a} 0 12px, transparent 12.5px)`,
        backgroundSize: '28px 28px',
      };
    case 'bloom':
      return {
        ...base,
        backgroundImage: `radial-gradient(circle at 30% 30%, ${b} 3px, transparent 3.5px), radial-gradient(circle at 70% 70%, ${b} 2px, transparent 2.5px), repeating-linear-gradient(115deg, transparent 0 22px, ${withAlpha(b, 0.18)} 22px 23px)`,
        backgroundSize: '54px 54px, 38px 38px, auto',
      };
    case 'solid':
    case 'none':
    default:
      return base;
  }
}

function StampArt({ id, color }: { id: string; color: string }) {
  return (
    <svg viewBox="0 0 40 48" width="100%" height="100%" aria-hidden>
      <rect x="0" y="0" width="40" height="48" fill="#fffdf8" />
      <g fill="none" stroke={color} strokeWidth="1.1">
        {id === 'arch' && (
          <>
            <path d="M12 36V22a8 8 0 0 1 16 0v14" />
            <path d="M8 39h24" />
          </>
        )}
        {id === 'bloom' && (
          <>
            <path d="M20 36c0-8 0-14 0-20" />
            <circle cx="20" cy="13" r="5" />
            <path d="M20 21c-5 0-8-2-9-6 5-1 8 1 9 6z" />
            <path d="M20 25c5 0 8-2 9-6-5-1-8 1-9 6z" />
          </>
        )}
        {id === 'deco' && (
          <>
            <path d="M20 40V18" />
            <path d="M20 24l-9-8M20 24l9-8M20 30l-13-8M20 30l13-8" />
            <path d="M8 40h24" />
          </>
        )}
        {id === 'field' && (
          <>
            <path d="M8 32h24M8 27h24M8 22h24M8 17h24" />
            <path d="M20 10v28" opacity="0.4" />
          </>
        )}
        {id === 'balloon' && (
          <>
            <ellipse cx="20" cy="18" rx="8.5" ry="10.5" />
            <path d="M17 28h6l-3 3z" />
            <path d="M20 31c0 4 3 5 3 9" />
            <path d="M8 41h24" opacity="0.5" />
          </>
        )}
        {id === 'candle' && (
          <>
            <rect x="15" y="22" width="10" height="16" />
            <path d="M20 22v-4" />
            <ellipse cx="20" cy="14" rx="3.4" ry="5.2" />
            <path d="M8 41h24" opacity="0.5" />
          </>
        )}
        {id === 'star' && (
          <>
            <path d="M20 10l2.6 8.4L31 21l-8.4 2.6L20 32l-2.6-8.4L9 21l8.4-2.6z" />
            <circle cx="20" cy="21" r="1.6" fill={color} stroke="none" />
            <path d="M12 36h16" opacity="0.5" />
          </>
        )}
        {id === 'initial' && (
          <>
            <circle cx="20" cy="24" r="11" />
            <text
              x="20"
              y="29"
              textAnchor="middle"
              fontFamily="Georgia, serif"
              fontSize="14"
              fill={color}
              stroke="none"
            >
              A
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

/** A small wax seal: either the host's initial pressed into wax, or a rosette. */
function Seal({ style, initial }: { style: string; initial: string }) {
  const ink = readableOn(style);
  if (style === 'monogram') {
    return (
      <svg viewBox="0 0 40 40" width="74%" height="74%" aria-hidden>
        <text
          x="20"
          y="28"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="24"
          fill={ink}
          opacity="0.92"
        >
          {initial}
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" width="78%" height="78%" aria-hidden className="seal-rosette">
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={ink} strokeWidth="0.9" opacity="0.45" />
      <g fill={ink} opacity="0.72">
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * Math.PI) / 4 - Math.PI / 2;
          // Rounded, so the server and browser agree to the digit and hydration is clean.
          const x = Math.round((20 + Math.cos(angle) * 9.5) * 100) / 100;
          const y = Math.round((20 + Math.sin(angle) * 9.5) * 100) / 100;
          return <ellipse key={i} cx={x} cy={y} rx="3.1" ry="1.9" transform={`rotate(${(i * 45)} ${x} ${y})`} />;
        })}
      </g>
      <circle cx="20" cy="20" r="3" fill={ink} opacity="0.9" />
    </svg>
  );
}

/** Faint postal cancellation beside the stamp. */
function Postmark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 60" aria-hidden className="env-postmark">
      <g fill="none" stroke={color} strokeWidth="1.6" opacity="0.55">
        <circle cx="26" cy="30" r="20" />
        <circle cx="26" cy="30" r="14" opacity="0.6" />
        <path d="M52 22c14 4 30 4 46 0M52 30c14 4 30 4 46 0M52 38c14 4 30 4 46 0" opacity="0.45" />
      </g>
    </svg>
  );
}

type Props = {
  envelope: Envelope;
  /** Which design the envelope belongs to, so older envelopes inherit new details. */
  designSlug?: string;
  guestName?: string | null;
  /** Printed into the wax seal — normally the host's name. */
  monogram?: string;
  open?: boolean;
  /** Card rendered inside the pocket, revealed by the open sequence. */
  peek?: ReactNode;
  /** Slide the peek card up and out of the envelope. */
  peeking?: boolean;
  className?: string;
  onClick?: () => void;
};

export default function EnvelopeCard({
  envelope,
  designSlug,
  guestName,
  monogram,
  open = false,
  peek,
  peeking = false,
  className = '',
  onClick,
}: Props) {
  const env = resolveEnvelope(envelope, designSlug);
  const base = normalizeHex(env.color);
  const nameColor = readableOn(base);
  const name = guestName?.trim() ? guestName.trim() : 'Guest name';
  const initial = (monogram ?? '').trim().charAt(0).toUpperCase() || 'E';
  // On dark stock a dark crease disappears; folds catch the light instead.
  const crease = readableOn(base) === '#1a1a1a' ? withAlpha('#2a1d0c', 0.4) : withAlpha('#ffffff', 0.3);

  return (
    <div
      className={`env ${open ? 'is-open' : ''} ${className}`}
      data-flap={env.flap}
      data-texture={env.texture}
      data-animation={env.openAnimation}
      onClick={onClick}
    >
      <div className="env-body" style={{ background: base }}>
        <div className="env-liner" style={linerStyle(env)} />

        <div
          className="env-pocket"
          style={{ background: `linear-gradient(184deg, ${shade(base, 0.035)}, ${base} 34%, ${shade(base, -0.025)})` }}
        />

        <svg className="env-fold" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <filter id="env-fold-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
          </defs>
          <path
            d={FOLD_PATHS[env.flap]}
            fill="none"
            stroke={crease}
            strokeWidth="1.1"
            filter="url(#env-fold-blur)"
          />
        </svg>

        <div
          className="env-flap"
          style={{
            background: `linear-gradient(158deg, ${shade(base, 0.07)}, ${base} 62%, ${shade(base, -0.02)})`,
          }}
        >
          <div className="env-flap-back" style={linerStyle(env)} />
        </div>

        <div className="env-address" style={{ color: nameColor }}>
          <span className="env-for">For</span>
          <span className="env-name" style={{ fontFamily: env.font }}>
            {name}
          </span>
        </div>

        <Postmark color={withAlpha(nameColor, 0.5)} />

        <div className="env-stamp">
          <StampArt id={env.stamp} color={env.stampColor} />
        </div>

        {env.returnAddress ? (
          <div className="env-return" style={{ color: withAlpha(nameColor, 0.75) }}>
            {env.returnAddress}
          </div>
        ) : null}

        {env.seal !== 'none' ? (
          <div
            className={`env-seal is-${env.seal}`}
            style={{
              background: `radial-gradient(90% 90% at 32% 24%, ${shade(env.sealColor, 0.22)}, ${normalizeHex(env.sealColor)} 58%, ${shade(env.sealColor, -0.16)})`,
              boxShadow: `0 3px 6px -2px rgba(0, 0, 0, 0.45), inset 0 1px 2px ${withAlpha('#ffffff', 0.4)}, inset 0 -2px 4px ${withAlpha('#000000', 0.22)}`,
              color: readableOn(env.sealColor),
            }}
          >
            <Seal style={env.seal} initial={initial} />
          </div>
        ) : null}

        <div className="env-paper" aria-hidden />
      </div>

      {peek ? (
        <div className={`env-peek${peeking ? ' is-out' : ''}`} aria-hidden>
          {peek}
        </div>
      ) : null}
    </div>
  );
}

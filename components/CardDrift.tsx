import type { CSSProperties, ReactNode } from 'react';
import type { DriftId } from '@/lib/types';

export const DRIFTS: { id: DriftId | 'none' | 'snow'; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'leaves', label: 'Falling leaves' },
  { id: 'petals', label: 'Drifting petals' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'sparkle', label: 'Gilt sparkle' },
  { id: 'motes', label: 'Dust motes' },
  { id: 'snow', label: 'Falling snow' },
];

type Vars = CSSProperties & Record<string, string | number>;

const COUNTS: Record<DriftId, number> = {
  leaves: 11,
  petals: 12,
  confetti: 16,
  sparkle: 14,
  motes: 13,
  snow: 15,
};

const SHAPES: Record<DriftId, string> = {
  leaves: 'leaf',
  petals: 'petal',
  confetti: 'confetti',
  sparkle: 'sparkle',
  motes: 'mote',
  snow: 'snowflake',
};

/**
 * Deterministic hash rather than Math.random: the server and the browser must
 * draw the same particles or hydration would mismatch. Integer maths keeps it
 * identical across engines.
 */
function fraction(index: number, salt: number): number {
  let h = (index + 1) * 374761393 + salt * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

function between(index: number, salt: number, min: number, max: number): number {
  return Math.round((min + fraction(index, salt) * (max - min)) * 100) / 100;
}

function falling(index: number, kind: 'leaves' | 'petals' | 'confetti' | 'snow', ink: string, accent: string): Vars {
  const width =
    kind === 'confetti'
      ? between(index, 2, 1, 1.6)
      : kind === 'leaves'
        ? between(index, 2, 2.8, 4.6)
        : kind === 'snow'
          ? between(index, 3, 1.5, 3.5)
          : between(index, 2, 2.6, 4.4);
  const height = kind === 'confetti' ? between(index, 3, 2.8, 3.8) : width * (kind === 'leaves' ? 1.75 : kind === 'snow' ? 1.5 : 1.15);
  const spin = kind === 'confetti' ? between(index, 6, -720, 720) : between(index, 6, 180, 540);
  return {
    left: `${between(index, 4, -2, 98)}%`,
    width: `${width}cqw`,
    height: `${Math.round(height * 100) / 100}cqw`,
    opacity: between(index, 7, 0.45, 0.9),
    background: fraction(index, 8) > 0.55 ? ink : accent,
    animationDuration: `${between(index, 9, kind === 'confetti' ? 7 : kind === 'snow' ? 16 : 13, kind === 'confetti' ? 13 : kind === 'snow' ? 18 : 24)}s`,
    animationDelay: `-${between(index, 10, 0, 20)}s`,
    ['--sway' as string]: `${between(index, 5, -9, 9)}cqw`,
    ['--spin' as string]: `${spin}deg`,
  };
}

function glint(index: number, accent: string): Vars {
  const size = between(index, 3, 1.5, 2.8);
  return {
    left: `${between(index, 4, -1, 99)}%`,
    top: `${between(index, 5, 2, 96)}%`,
    width: `${size}cqw`,
    height: `${size}cqw`,
    background: accent,
    animationDuration: `${between(index, 9, 2.6, 5.8)}s`,
    animationDelay: `-${between(index, 10, 0, 6)}s`,
    ['--op' as string]: between(index, 7, 0.35, 0.9),
  };
}

function mote(index: number, ink: string): Vars {
  const size = between(index, 3, 0.45, 1.1);
  return {
    left: `${between(index, 4, -1, 99)}%`,
    top: `${between(index, 5, 8, 96)}%`,
    width: `${size}cqw`,
    height: `${size}cqw`,
    background: ink,
    animationDuration: `${between(index, 9, 10, 21)}s`,
    animationDelay: `-${between(index, 10, 0, 18)}s`,
    ['--op' as string]: between(index, 7, 0.16, 0.4),
    ['--sway' as string]: `${between(index, 5, -5, 5)}cqw`,
  };
}

/** Animated artwork drawn over the card, behind the words. Pure CSS, no images. */
export default function CardDrift({
  kind,
  ink,
  accent,
}: {
  kind: DriftId | null | undefined;
  ink: string;
  accent: string;
}) {
  if (!kind) return null;

  const bits: ReactNode[] = [];
  for (let index = 0; index < COUNTS[kind]; index += 1) {
    const style =
      kind === 'sparkle'
        ? glint(index, accent)
        : kind === 'motes'
          ? mote(index, ink)
          : kind === 'snow'
            ? snowflake(index, ink)
            : falling(index, kind, ink, accent);
    bits.push(
      <span key={index} className={`drift-bit is-${SHAPES[kind]}`} style={style} />,
    );
  }

  return (
    <div className="card-drift" aria-hidden data-drift={kind}>
      {bits}
    </div>
  );
}

function snowflake(index: number, ink: string): Vars {
  const size = between(index, 3, 1, 2.5);
  const sway = between(index, 5, -10, 10);
  const spin = between(index, 6, 0, 360);
  const duration = between(index, 7, 12, 20);
  const delay = between(index, 8, 0, 15);
  return {
    left: `${between(index, 4, -2, 98)}%`,
    top: `${between(index, 5, -10, 10)}%`,
    width: `${size}cqw`,
    height: `${size}cqw`,
    background: ink,
    borderRadius: '50%',
    animationName: 'snow-fall',
    animationDuration: `${duration}s`,
    animationDelay: `-${delay}s`,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    ['--sway' as string]: `${sway}deg`,
    ['--spin' as string]: `${spin}deg`,
  };
}


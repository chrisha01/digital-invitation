import type { EnvelopeAnimation } from './types';

export type EnvelopeAnimationProfile = {
  id: EnvelopeAnimation;
  label: string;
  blurb: string;
  /** Milliseconds the flap takes to finish opening. */
  flapMs: number;
  /** Milliseconds after the tap when the card starts to rise. */
  peekAt: number;
  /** Milliseconds after the tap when the envelope hands over to the card. */
  cardAt: number;
  /** Milliseconds after the tap when the empty envelope has fully left. */
  doneAt: number;
};

/**
 * The four opening sequences. CSS reads the same ids from `data-animation`;
 * keep the durations here and in `app/globals.css` in step.
 */
export const ENVELOPE_ANIMATIONS: EnvelopeAnimationProfile[] = [
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'The flap peels back, then the card rises out of the pocket.',
    flapMs: 900,
    peekAt: 620,
    cardAt: 1850,
    doneAt: 2420,
  },
  {
    id: 'quick',
    label: 'Quick open',
    blurb: 'Brisk and unfussy — the flap lifts and the card is out in a breath.',
    flapMs: 520,
    peekAt: 340,
    cardAt: 1100,
    doneAt: 1560,
  },
  {
    id: 'slow',
    label: 'Slow reveal',
    blurb: 'A long, unhurried peel before the card is drawn out.',
    flapMs: 1400,
    peekAt: 900,
    cardAt: 2650,
    doneAt: 3300,
  },
  {
    id: 'wide',
    label: 'Wide open',
    blurb: 'The flap folds far back, showing the liner, as the card lifts high.',
    flapMs: 1000,
    peekAt: 660,
    cardAt: 2020,
    doneAt: 2620,
  },
];

export function envelopeAnimation(id?: EnvelopeAnimation | null): EnvelopeAnimationProfile {
  return ENVELOPE_ANIMATIONS.find((animation) => animation.id === id) ?? ENVELOPE_ANIMATIONS[0];
}

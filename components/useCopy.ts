'use client';

import { useState } from 'react';

export type CopyOutcome =
  | { outcome: 'copied' }
  | { outcome: 'failed'; reason: string; text: string };

/**
 * Copy text to the clipboard. When the clipboard API is unavailable or
 * denied, the outcome includes the text so the caller can render a
 * read-only textarea the user can select and copy manually.
 */
export function useCopy() {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);

  async function copy(text: string): Promise<CopyOutcome | null> {
    // Reset any prior outcome so a fresh attempt isn't conflated with a
    // previous "copied" toast.
    setOutcome(null);

    if (!navigator.clipboard?.writeText) {
      const result: CopyOutcome = {
        outcome: 'failed',
        reason: 'Clipboard is not available in this browser.',
        text,
      };
      setOutcome(result);
      return result;
    }

    try {
      await navigator.clipboard.writeText(text);
      const result: CopyOutcome = { outcome: 'copied' };
      setOutcome(result);
      return result;
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Clipboard access was blocked by this browser — use the text below to copy manually.'
          : 'Copying failed — use the text below to copy manually.';
      const result: CopyOutcome = { outcome: 'failed', reason: message, text };
      setOutcome(result);
      return result;
    }
  }

  /** Clear the outcome so the UI can move back to the idle button label. */
  function clear() {
    setOutcome(null);
  }

  return { copy, outcome, clear };
}
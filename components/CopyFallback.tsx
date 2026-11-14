'use client';

import type { CopyOutcome } from './useCopy';

interface CopyFallbackProps {
  outcome: CopyOutcome;
}

function isFailed(outcome: CopyOutcome): outcome is Extract<CopyOutcome, { outcome: 'failed' }> {
  return outcome.outcome === 'failed';
}

export default function CopyFallback({ outcome }: CopyFallbackProps) {
  if (!isFailed(outcome)) return null;
  return (
    <>
      <p className="form-error">{outcome.reason}</p>
      <textarea
        className="input mono"
        rows={outcome.text.includes('\n') ? 4 : 2}
        readOnly
        value={outcome.text}
        onClick={(e) => e.currentTarget.select()}
        aria-label="Copy this text manually"
      />
    </>
  );
}
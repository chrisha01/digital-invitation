export type FontOption = {
  label: string;
  stack: string;
  kind: 'serif' | 'sans' | 'script' | 'mono';
};

export const FONTS: FontOption[] = [
  { label: 'Bodoni Moda', stack: '"Bodoni Moda", "Times New Roman", serif', kind: 'serif' },
  { label: 'Cormorant Garamond', stack: '"Cormorant Garamond", Georgia, serif', kind: 'serif' },
  { label: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', kind: 'serif' },
  { label: 'Libre Baskerville', stack: '"Libre Baskerville", Georgia, serif', kind: 'serif' },
  { label: 'Great Vibes', stack: '"Great Vibes", cursive', kind: 'script' },
  { label: 'Caveat', stack: '"Caveat", cursive', kind: 'script' },
  { label: 'Jost', stack: '"Jost", "Helvetica Neue", Arial, sans-serif', kind: 'sans' },
  { label: 'DM Sans', stack: '"DM Sans", "Helvetica Neue", Arial, sans-serif', kind: 'sans' },
  { label: 'Inter', stack: '"Inter", system-ui, sans-serif', kind: 'sans' },
  { label: 'Space Mono', stack: '"Space Mono", ui-monospace, monospace', kind: 'mono' },
];

export function fontStack(labelOrStack: string): string {
  const found = FONTS.find((f) => f.label === labelOrStack || f.stack === labelOrStack);
  return found ? found.stack : labelOrStack;
}

export function fontLabel(labelOrStack: string): string {
  const found = FONTS.find((f) => f.label === labelOrStack || f.stack === labelOrStack);
  return found ? found.label : labelOrStack;
}

export const fontHeading = '"Cormorant Garamond", Georgia, serif';
export const fontBody = '"Jost", "Helvetica Neue", Arial, sans-serif';

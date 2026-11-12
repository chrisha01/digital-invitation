export function normalizeHex(input: string): string {
  let hex = input.trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#000000';
  return `#${hex.toLowerCase()}`;
}

export function luminance(hex: string): number {
  const h = normalizeHex(hex).slice(1);
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#1a1a1a' : '#ffffff';
}

export function shade(hex: string, amount: number): string {
  const h = normalizeHex(hex).slice(1);
  const parts = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const out = parts.map((c) => {
    const target = amount < 0 ? 0 : 255;
    const t = Math.abs(amount);
    return Math.round(c + (target - c) * t);
  });
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const h = normalizeHex(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

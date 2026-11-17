import type { CSSProperties } from 'react';
import { luminance, shade } from './color';
import type { Backdrop } from './types';

/** x, y, width, height, rotation, fill, opacity */
type Piece = [number, number, number, number, number, string, number];

/**
 * A tileable sheet of confetti, drawn once as an SVG data URI so the pieces are
 * proper little paper slivers rather than the blobs a radial gradient gives.
 */
function confettiTile(soft: string, strong: string): string {
  const pieces: Piece[] = [
    [8, 10, 9, 4, 18, strong, 0.9],
    [34, 4, 7, 3, -24, soft, 0.95],
    [62, 16, 10, 4, 42, strong, 0.8],
    [92, 6, 6, 3, -12, soft, 0.9],
    [110, 28, 9, 4, 66, strong, 0.75],
    [16, 40, 8, 3, -38, strong, 0.85],
    [46, 52, 6, 6, 12, soft, 0.9],
    [74, 44, 10, 4, -8, strong, 0.8],
    [100, 62, 7, 3, 30, soft, 0.9],
    [6, 74, 9, 4, 52, strong, 0.9],
    [36, 86, 6, 6, -18, soft, 0.9],
    [64, 78, 9, 4, 24, strong, 0.8],
    [88, 96, 7, 3, -44, soft, 0.9],
    [112, 88, 8, 4, 14, strong, 0.85],
    [20, 108, 7, 3, 62, strong, 0.8],
    [52, 112, 6, 6, -6, soft, 0.9],
    [82, 116, 9, 4, 38, strong, 0.75],
    [108, 108, 6, 3, -28, soft, 0.9],
  ];
  const body = pieces
    .map(
      ([x, y, w, h, rotation, fill, opacity]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${fill}" opacity="${opacity}" transform="rotate(${rotation} ${x + w / 2} ${y + h / 2})"/>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="124" height="124">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * The single painter for backdrop surfaces. The editor stage and the guest page
 * both use it so a pattern chosen in the editor looks the same to a guest.
 */
export function backdropStyle(backdrop: Backdrop): CSSProperties {
  const { color1, color2, pattern, image } = backdrop;
  if (image) {
    return {
      backgroundImage: `url(${image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  switch (pattern) {
    case 'paper':
      return {
        background: color1,
        backgroundImage: `radial-gradient(${color2} 1px, transparent 1.2px)`,
        backgroundSize: '7px 7px',
      };
    case 'linen':
      return {
        background: color1,
        backgroundImage: `repeating-linear-gradient(0deg, ${color2}33 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${color2}33 0 1px, transparent 1px 4px)`,
      };
    case 'confetti': {
      // On a pale surface the confetti has to go darker to be seen, and vice versa.
      const strong = shade(color2, luminance(color1) > 0.45 ? -0.32 : 0.34);
      return {
        backgroundColor: color1,
        backgroundImage: `${confettiTile(color2, strong)}, linear-gradient(160deg, ${color1}, ${shade(color1, -0.07)})`,
        backgroundSize: '124px 124px, cover',
        backgroundRepeat: 'repeat, no-repeat',
      };
    }
    case 'sunburst':
      return {
        background: `conic-gradient(from 200deg at 50% -20%, ${color2} 0 6deg, ${color1} 6deg 14deg)`,
      };
    case 'gradient':
      return { background: `linear-gradient(165deg, ${color1}, ${color2})` };
    case 'plain':
    case 'upload':
    default:
      return { background: color1 };
  }
}

import type { CSSProperties } from 'react';
import type { Backdrop } from './types';

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
    case 'confetti':
      return {
        background: `linear-gradient(160deg, ${color1}, ${color2})`,
        backgroundImage: `radial-gradient(circle at 12% 22%, ${color2} 6px, transparent 7px), radial-gradient(circle at 82% 14%, ${color1} 8px, transparent 9px), radial-gradient(circle at 68% 78%, ${color2} 5px, transparent 6px), radial-gradient(circle at 24% 84%, ${color1} 10px, transparent 11px)`,
      };
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

import type { CSSProperties } from 'react';

export type MotifId =
  | 'arch'
  | 'trellis'
  | 'deco'
  | 'rule'
  | 'terrazzo'
  | 'bloom'
  | 'frame'
  | 'sun'
  | 'balloons'
  | 'bunting'
  | 'candles'
  | 'stars'
  | 'rings'
  | 'mobile'
  | 'fir'
  | 'tree'
  | 'forest'
  | 'fireworks'
  | 'tassel'
  | 'coupe'
  | 'branch'
  | 'wheat'
  | 'key';

/** A four-point star, used from a handful of places in the birthday artwork. */
const STAR = 'M0 -1 L0.22 -0.22 L1 0 L0.22 0.22 L0 1 L-0.22 0.22 L-1 0 L-0.22 -0.22 Z';

/**
 * Ten evenly spaced directions, written out rather than computed: trig results
 * can differ in the last digit between the server and the browser, which React
 * reports as a hydration mismatch.
 */
const RAYS: [number, number][] = [
  [1, 0],
  [0.809, 0.588],
  [0.309, 0.951],
  [-0.309, 0.951],
  [-0.809, 0.588],
  [-1, 0],
  [-0.809, -0.588],
  [-0.309, -0.951],
  [0.309, -0.951],
  [0.809, -0.588],
];

const svgStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

/** Original decorative artwork — drawn for this project, not copied from any stationery design. */
export function Motif({ id, ink, accent }: { id: string; ink: string; accent: string }) {
  switch (id) {
    case 'arch':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d="M150 500V260a100 100 0 0 1 200 0v240" fill="none" stroke={ink} strokeWidth={1.4} opacity={0.55} />
          <path d="M168 500V262a82 82 0 0 1 164 0v238" fill="none" stroke={ink} strokeWidth={0.8} opacity={0.35} />
          <circle cx="250" cy="142" r="3.2" fill={accent} />
          <path d="M120 512h260" stroke={ink} strokeWidth={0.8} opacity={0.35} />
        </svg>
      );
    case 'trellis':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1.1} opacity={0.5}>
            <path d="M28 700V120" />
            <path d="M472 700V120" />
            <path d="M28 210c40 6 60 26 66 66" />
            <path d="M472 210c-40 6-60 26-66 66" />
            <path d="M28 380c40 6 60 26 66 66" />
            <path d="M472 380c-40 6-60 26-66 66" />
          </g>
          <g fill={accent} opacity={0.7}>
            <circle cx="94" cy="276" r="4" />
            <circle cx="406" cy="276" r="4" />
            <circle cx="94" cy="446" r="4" />
            <circle cx="406" cy="446" r="4" />
          </g>
        </svg>
      );
    case 'deco':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={accent} strokeWidth={1.2} opacity={0.85}>
            <path d="M250 78v-38M210 78l-18-34M290 78l18-34M172 82l-32-26M328 82l32-26M140 92l-40-12M360 92l40-12" />
            <path d="M250 622v38M210 622l-18 34M290 622l18 34M172 618l-32 26M328 618l32 26M140 608l-40 12M360 608l40 12" />
          </g>
          <rect x="34" y="34" width="432" height="632" fill="none" stroke={accent} strokeWidth={0.8} opacity={0.5} />
        </svg>
      );
    case 'rule':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g stroke={ink} opacity={0.5} fill="none">
            <path d="M150 92h200" strokeWidth={0.9} />
            <path d="M150 620h200" strokeWidth={0.9} />
          </g>
          <path d="M250 84l6 8-6 8-6-8z" fill={accent} />
          <path d="M250 612l6 8-6 8-6-8z" fill={accent} />
        </svg>
      );
    case 'terrazzo':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g opacity={0.55}>
            <circle cx="74" cy="96" r="9" fill={accent} />
            <circle cx="418" cy="128" r="5" fill={ink} />
            <circle cx="60" cy="300" r="4" fill={ink} />
            <circle cx="446" cy="360" r="8" fill={accent} />
            <circle cx="96" cy="552" r="6" fill={accent} />
            <circle cx="404" cy="596" r="4" fill={ink} />
            <path d="M392 236l14 8-6 15z" fill={ink} opacity={0.5} />
            <path d="M86 440l16 4-4 14z" fill={accent} />
            <circle cx="250" cy="656" r="3" fill={ink} />
            <circle cx="250" cy="44" r="3" fill={ink} />
          </g>
        </svg>
      );
    case 'bloom':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1.1} opacity={0.6}>
            <path d="M68 656c0-70 22-118 54-152" />
            <path d="M96 570c-22-8-32-28-26-46 20 2 32 20 26 46z" />
            <path d="M110 546c22-10 32-30 24-48-20 4-30 22-24 48z" />
            <circle cx="122" cy="498" r="15" />
            <circle cx="122" cy="498" r="7" fill={accent} stroke="none" opacity={0.8} />
          </g>
          <g fill="none" stroke={ink} strokeWidth={1} opacity={0.45}>
            <path d="M432 44c0 60-16 98-44 126" />
            <circle cx="388" cy="176" r="11" />
          </g>
        </svg>
      );
    case 'frame':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <rect x="28" y="28" width="444" height="644" fill="none" stroke={ink} strokeWidth={1.2} opacity={0.55} />
          <rect x="36" y="36" width="428" height="628" fill="none" stroke={ink} strokeWidth={0.6} opacity={0.35} />
          <g fill={accent} opacity={0.9}>
            <circle cx="28" cy="28" r="3" />
            <circle cx="472" cy="28" r="3" />
            <circle cx="28" cy="672" r="3" />
            <circle cx="472" cy="672" r="3" />
          </g>
        </svg>
      );
    case 'sun':
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <circle cx="250" cy="196" r="126" fill={accent} opacity={0.22} />
          <circle cx="250" cy="196" r="126" fill="none" stroke={accent} strokeWidth={0.9} opacity={0.55} />
          <path d="M60 470h380" stroke={ink} strokeWidth={0.8} opacity={0.25} />
          <path d="M104 250c60-34 232-34 292 0" fill="none" stroke={ink} strokeWidth={0.7} opacity={0.2} />
        </svg>
      );
    case 'balloons':
      // A small bunch escaping the top corner, strings trailing, one lost on the way.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill={accent} fillOpacity={0.18} stroke={ink} strokeWidth={1.2} opacity={0.6}>
            <ellipse cx="424" cy="132" rx="29" ry="35" />
            <ellipse cx="470" cy="180" rx="23" ry="28" />
            <ellipse cx="384" cy="190" rx="25" ry="30" />
          </g>
          <g fill={ink} opacity={0.5}>
            <path d="M420 165l4 7h-8z" />
            <path d="M466 206l4 6h-8z" />
            <path d="M380 218l4 6h-8z" />
          </g>
          <g fill="none" stroke={ink} strokeWidth={0.9} opacity={0.4}>
            <path d="M424 172c-10 42-18 76-26 110" />
            <path d="M470 212c-6 30-10 58-16 84" />
            <path d="M384 224c-4 26-6 50-4 72" />
          </g>
          <circle cx="74" cy="630" r="15" fill={accent} fillOpacity={0.22} stroke={ink} strokeWidth={1} opacity={0.5} />
          <path d="M74 645c2 18 4 30 6 42" fill="none" stroke={ink} strokeWidth={0.8} opacity={0.35} />
        </svg>
      );
    case 'bunting':
      // Two strings of pennants, sagging across the top third.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d="M0 74c84 46 166 46 250 8 84 38 166 38 250-8" fill="none" stroke={ink} strokeWidth={1} opacity={0.45} />
          <g fill={accent} fillOpacity={0.16} stroke={ink} strokeWidth={1} opacity={0.55}>
            {[
              [60, 87],
              [110, 97],
              [160, 104],
              [210, 109],
              [260, 110],
              [310, 107],
              [360, 102],
              [410, 93],
              [460, 83],
            ].map(([x, y]) => (
              <path key={x} d={`M${x - 13} ${y}H${x + 13}L${x} ${y + 32}Z`} />
            ))}
          </g>
          <g fill={ink} opacity={0.4}>
            <circle cx="96" cy="652" r="3" />
            <circle cx="404" cy="652" r="3" />
          </g>
          <g fill={accent} opacity={0.6}>
            <circle cx="60" cy="648" r="2.4" />
            <circle cx="440" cy="648" r="2.4" />
          </g>
        </svg>
      );
    case 'candles':
      // Two tapers framing the card, each with a soft halo.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1.2} opacity={0.5}>
            <path d="M26 700V486h16v214" />
            <path d="M458 700V540h16v160" />
          </g>
          <g fill={accent}>
            <circle cx="34" cy="466" r="30" opacity={0.1} />
            <ellipse cx="34" cy="470" rx="5.5" ry="10" opacity={0.85} />
            <circle cx="466" cy="522" r="26" opacity={0.1} />
            <ellipse cx="466" cy="526" rx="5" ry="9" opacity={0.85} />
          </g>
        </svg>
      );
    case 'stars':
      // Scattered four-point stars, heavier in the corners so the middle stays clear.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill={accent} opacity={0.8}>
            {[
              [86, 108, 11],
              [148, 74, 6],
              [414, 148, 8],
              [456, 96, 5],
              [104, 596, 7],
              [64, 640, 4],
              [402, 580, 12],
              [446, 632, 6],
              [250, 48, 5],
            ].map(([x, y, r]) => (
              <path key={`${x}-${y}`} d={STAR} transform={`translate(${x} ${y}) scale(${r})`} />
            ))}
          </g>
          <g fill="none" stroke={ink} strokeWidth={0.8} opacity={0.28}>
            <path d="M214 148h72" />
            <path d="M230 136h40" opacity={0.7} />
            <path d="M214 560h72" />
            <path d="M230 572h40" opacity={0.7} />
          </g>
        </svg>
      );
    case 'rings':
      // Two wedding bands resting in the bottom corner, with one glint of gold.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1.2} opacity={0.5}>
            <circle cx="84" cy="626" r="23" />
            <circle cx="114" cy="620" r="20" />
          </g>
          <circle cx="126" cy="598" r="2.4" fill={accent} opacity={0.85} />
          <path d="M48 664h132" stroke={ink} strokeWidth={0.7} opacity={0.25} />
        </svg>
      );
    case 'mobile':
      // A nursery mobile hung from the top corner.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d="M296 62c62 20 106 20 164-2" fill="none" stroke={ink} strokeWidth={0.9} opacity={0.4} />
          <g fill="none" stroke={ink} strokeWidth={0.8} opacity={0.35}>
            <path d="M334 78v86" />
            <path d="M402 88v130" />
            <path d="M456 70v64" />
          </g>
          <g fill={accent} fillOpacity={0.2} stroke={ink} strokeWidth={1.1} opacity={0.6}>
            <circle cx="334" cy="184" r="13" />
            <path d="M402 200l14 22h-28z" />
            <circle cx="456" cy="148" r="10" />
          </g>
          <g fill={accent} opacity={0.7}>
            <path d={STAR} transform="translate(372 250) scale(4)" />
            <path d={STAR} transform="translate(464 236) scale(3)" />
          </g>
        </svg>
      );
    case 'fir':
      // A fir branch down the left margin, needles paired along the stem.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d="M78 700C92 566 96 430 88 296 84 214 76 150 66 100" fill="none" stroke={ink} strokeWidth={1.1} opacity={0.5} />
          <g fill="none" stroke={ink} strokeWidth={0.9} opacity={0.4}>
            {[180, 250, 320, 390, 460, 530, 600].map((y, i) => (
              <g key={y}>
                <path d={`M${86 - i * 1.6} ${y}l-28-15`} />
                <path d={`M${86 - i * 1.6} ${y}l26-17`} />
              </g>
            ))}
          </g>
          <g fill={accent} opacity={0.75}>
            <path d={STAR} transform="translate(420 96) scale(6)" />
            <path d={STAR} transform="translate(452 168) scale(4)" />
            <path d={STAR} transform="translate(398 214) scale(3)" />
          </g>
        </svg>
      );
    case 'tree':
      // A whole fir as a background watermark: tiers, a star and a few baubles.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill={ink} fillOpacity={0.09} stroke={ink} strokeWidth={1.5} strokeOpacity={0.4}>
            <path d="M250 142l108 168H142z" />
            <path d="M250 236l150 196H100z" />
            <path d="M250 344l196 228H54z" />
            <path d="M232 566h36v58h-36z" />
          </g>
          <path d={STAR} transform="translate(250 126) scale(13)" fill={accent} opacity={0.95} />
          <g fill="none" stroke={ink} strokeWidth={0.9} opacity={0.22}>
            <path d="M160 300q90 26 180 0" />
            <path d="M116 424q134 34 268 0" />
            <path d="M74 556q176 40 352 0" />
          </g>
          <g fill={accent}>
            <circle cx="176" cy="288" r="4.5" opacity="0.9" />
            <circle cx="324" cy="286" r="4" opacity="0.9" />
            <circle cx="140" cy="400" r="5" opacity="0.85" />
            <circle cx="358" cy="398" r="4.5" opacity="0.85" />
            <circle cx="206" cy="430" r="3.5" opacity="0.8" />
            <circle cx="300" cy="452" r="4" opacity="0.8" />
            <circle cx="110" cy="522" r="5" opacity="0.85" />
            <circle cx="390" cy="520" r="4.5" opacity="0.85" />
            <circle cx="190" cy="546" r="4" opacity="0.8" />
            <circle cx="312" cy="552" r="4.5" opacity="0.8" />
          </g>
          <g fill={ink} opacity="0.35">
            <circle cx="70" cy="120" r="2.4" />
            <circle cx="430" cy="150" r="2" />
            <circle cx="404" cy="90" r="1.8" />
            <circle cx="96" cy="220" r="1.8" />
            <circle cx="450" cy="300" r="2.2" />
            <circle cx="56" cy="380" r="2" />
          </g>
        </svg>
      );
    case 'forest':
      // A treeline along the bottom edge, snow drifting above it.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill={ink} fillOpacity={0.12} stroke={ink} strokeWidth={1.1} strokeOpacity={0.35}>
            <path d="M-4 700l58-142 62 142z" />
            <path d="M92 700l44-96 46 96z" />
            <path d="M202 700l40-76 42 76z" />
            <path d="M298 700l46-100 48 100z" />
            <path d="M368 700l70-152 70 152z" />
          </g>
          <g fill={ink} opacity="0.4">
            <circle cx="120" cy="500" r="2.2" />
            <circle cx="196" cy="548" r="1.8" />
            <circle cx="268" cy="512" r="2" />
            <circle cx="340" cy="556" r="1.8" />
            <circle cx="412" cy="500" r="2.2" />
            <circle cx="66" cy="566" r="1.8" />
            <circle cx="452" cy="590" r="2" />
          </g>
          <path d={STAR} transform="translate(96 508) scale(5)" fill={accent} opacity={0.6} />
          <path d={STAR} transform="translate(404 470) scale(4)" fill={accent} opacity={0.5} />
        </svg>
      );
    case 'fireworks':
      // Three bursts kept to the corners so the type stays clear.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g stroke={accent} strokeWidth={1} fill="none" opacity={0.75}>
            {[
              [82, 112, 1],
              [424, 158, 0.78],
              [386, 596, 0.55],
            ].map(([cx, cy, scale]) => (
              <g key={`${cx}-${cy}`}>
                {RAYS.map(([cos, sin], i) => {
                  const r1 = 8 * scale;
                  const r2 = (i % 2 ? 30 : 40) * scale;
                  return (
                    <path
                      key={i}
                      d={`M${cx + cos * r1} ${cy + sin * r1}L${cx + cos * r2} ${cy + sin * r2}`}
                    />
                  );
                })}
              </g>
            ))}
          </g>
          <g fill={ink} opacity={0.35}>
            <circle cx="150" cy="70" r="2" />
            <circle cx="460" cy="250" r="2" />
            <circle cx="320" cy="650" r="2" />
          </g>
        </svg>
      );
    case 'tassel':
      // A graduation tassel hung from the top margin.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1} opacity={0.45}>
            <path d="M418 34c-8 44-12 80-12 108" />
          </g>
          <circle cx="406" cy="150" r="6.5" fill="none" stroke={accent} strokeWidth={1.4} opacity={0.85} />
          <g stroke={accent} strokeWidth={1.1} fill="none" opacity={0.8}>
            {[-14, -9, -4, 0, 4, 9, 14].map((dx) => (
              <path key={dx} d={`M406 158c${dx / 3} 14 ${dx} 30 ${dx * 1.1} 44`} />
            ))}
          </g>
          <path d="M392 200c10 4 20 4 30 0" stroke={accent} strokeWidth={1.1} fill="none" opacity={0.8} />
        </svg>
      );
    case 'coupe':
      // A pair of coupes in the bottom corners.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1.1} opacity={0.45}>
            <path d="M52 574h86c0 24-19 36-43 36s-43-12-43-36z" />
            <path d="M95 610v28M74 642h42" />
            <path d="M368 596h64c0 18-14 27-32 27s-32-9-32-27z" />
            <path d="M400 623v20M384 647h32" />
          </g>
          <g fill={accent} opacity={0.7}>
            <circle cx="78" cy="590" r="2" />
            <circle cx="384" cy="608" r="1.6" />
          </g>
        </svg>
      );
    case 'branch':
      // A blossom branch rising up the left edge.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d="M52 700C70 596 96 512 138 452" fill="none" stroke={ink} strokeWidth={1.1} opacity={0.45} />
          <g fill="none" stroke={ink} strokeWidth={0.8} opacity={0.35}>
            <path d="M96 590c22-8 40-6 56 6" />
            <path d="M116 528c24-4 42 4 54 18" />
          </g>
          <g fill={accent} fillOpacity={0.28} stroke={ink} strokeWidth={0.9} opacity={0.65}>
            <circle cx="152" cy="596" r="9" />
            <circle cx="170" cy="546" r="7" />
            <circle cx="138" cy="452" r="10" />
            <circle cx="118" cy="500" r="6" />
          </g>
          <g fill={accent} opacity={0.8}>
            <circle cx="152" cy="596" r="2.6" />
            <circle cx="138" cy="452" r="3" />
          </g>
        </svg>
      );
    case 'wheat':
      // Three stalks of wheat standing in the bottom corner.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g fill="none" stroke={ink} strokeWidth={1} opacity={0.45}>
            <path d="M66 700C74 600 86 520 104 468" />
            <path d="M104 700c4-84 12-158 26-204" />
            <path d="M142 700c0-70-2-134-8-182" />
          </g>
          <g fill="none" stroke={accent} strokeWidth={1.1} opacity={0.8}>
            {[486, 506, 526, 546].map((y, i) => (
              <g key={y}>
                <path d={`M${102 + i * 2} ${y}l-13 9`} />
                <path d={`M${106 + i * 2} ${y + 4}l13 9`} />
              </g>
            ))}
            {[520, 540, 560].map((y, i) => (
              <g key={y}>
                <path d={`M${128 - i * 3} ${y}l-12 8`} />
                <path d={`M${132 - i * 3} ${y + 4}l12 8`} />
              </g>
            ))}
          </g>
        </svg>
      );
    case 'key':
      // A door key laid in the bottom corner.
      return (
        <svg style={svgStyle} viewBox="0 0 500 700" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g transform="rotate(-14 380 606)" fill="none" stroke={ink} strokeWidth={1.2} opacity={0.5}>
            <circle cx="330" cy="606" r="17" />
            <circle cx="330" cy="606" r="7" />
            <path d="M347 606h84" />
            <path d="M404 606v15M422 606v-13" />
          </g>
          <g fill={accent} opacity={0.7}>
            <circle cx="300" cy="576" r="2" />
            <circle cx="452" cy="638" r="1.6" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

export const MOTIFS: { id: MotifId | 'none'; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'arch', label: 'Arch' },
  { id: 'trellis', label: 'Trellis' },
  { id: 'deco', label: 'Deco fan' },
  { id: 'rule', label: 'Rule' },
  { id: 'terrazzo', label: 'Terrazzo' },
  { id: 'bloom', label: 'Bloom' },
  { id: 'frame', label: 'Frame' },
  { id: 'sun', label: 'Sun' },
  { id: 'balloons', label: 'Balloons' },
  { id: 'bunting', label: 'Bunting' },
  { id: 'candles', label: 'Candles' },
  { id: 'stars', label: 'Stars' },
  { id: 'rings', label: 'Rings' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'fir', label: 'Fir' },
  { id: 'tree', label: 'Christmas tree' },
  { id: 'forest', label: 'Treeline' },
  { id: 'fireworks', label: 'Fireworks' },
  { id: 'tassel', label: 'Tassel' },
  { id: 'coupe', label: 'Coupes' },
  { id: 'branch', label: 'Branch' },
  { id: 'wheat', label: 'Wheat' },
  { id: 'key', label: 'Key' },
];
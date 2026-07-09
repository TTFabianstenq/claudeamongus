"use client";

import { colorDarkHex, colorHex, type HatId, type PlayerColorId } from "@/shared/constants";

interface BeanProps {
  color: PlayerColorId | string;
  hat?: HatId | string;
  size?: number;
  dead?: boolean;
  flip?: boolean;
  className?: string;
}

/**
 * The crewmate rendered as an inline SVG — used everywhere outside the
 * canvas (lobby list, meeting cards, cosmetic picker, eject screen).
 */
export function Bean({ color, hat = "none", size = 64, dead = false, flip = false, className }: BeanProps) {
  const main = colorHex(color);
  const dark = colorDarkHex(color);
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={(size * 72) / 64}
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
      role="img"
    >
      {/* legs */}
      <rect x="16" y="52" width="12" height="16" rx="5" fill={dark} />
      <rect x="34" y="52" width="12" height="16" rx="5" fill={dark} />
      {/* backpack */}
      <rect x="4" y="24" width="12" height="26" rx="6" fill={dark} />
      {/* body */}
      <path
        d="M16 56 L16 26 Q16 8 33 8 Q50 8 50 28 L50 56 Q50 62 43 62 L23 62 Q16 62 16 56 Z"
        fill={main}
      />
      <path d="M16 44 L50 44 L50 56 Q50 62 43 62 L23 62 Q16 62 16 56 Z" fill="rgba(0,0,0,0.18)" />
      {/* visor */}
      {dead ? (
        <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round">
          <line x1="34" y1="20" x2="46" y2="30" />
          <line x1="46" y1="20" x2="34" y2="30" />
        </g>
      ) : (
        <>
          <ellipse cx="40" cy="25" rx="12" ry="8.5" fill="#9fdcef" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          <ellipse cx="36" cy="22" rx="5" ry="2.8" fill="rgba(255,255,255,0.65)" />
        </>
      )}
      {/* hat */}
      <Hat hat={hat} />
    </svg>
  );
}

function Hat({ hat }: { hat: string }) {
  switch (hat) {
    case "halo":
      return <ellipse cx="33" cy="0" rx="14" ry="4" fill="none" stroke="#ffe08a" strokeWidth="3.5" />;
    case "antenna":
      return (
        <g>
          <line x1="33" y1="8" x2="33" y2="-4" stroke="#c8d2e8" strokeWidth="2.5" />
          <circle cx="33" cy="-6" r="4" fill="#e2434b" />
        </g>
      );
    case "tophat":
      return (
        <g>
          <rect x="21" y="2" width="24" height="5" rx="2" fill="#20242f" />
          <rect x="26" y="-12" width="14" height="15" rx="2" fill="#20242f" />
          <rect x="26" y="-2" width="14" height="3" fill="#e2434b" />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M22 8 A11 11 0 0 1 44 8 Z" fill="#3151cb" />
          <circle cx="33" cy="-4" r="4" fill="#e8ecf5" />
        </g>
      );
    case "crown":
      return (
        <path
          d="M23 6 L23 -4 L28 2 L33 -6 L38 2 L43 -4 L43 6 Z"
          fill="#ffd166"
        />
      );
    case "leaf":
      return (
        <g>
          <path d="M33 8 Q35 0 33 -2" fill="none" stroke="#1a9160" strokeWidth="3" />
          <ellipse cx="28" cy="-3" rx="6" ry="3.5" fill="#57ef3a" transform="rotate(-25 28 -3)" />
          <ellipse cx="38" cy="-4" rx="6" ry="3.5" fill="#57ef3a" transform="rotate(25 38 -4)" />
        </g>
      );
    case "horns":
      return (
        <g fill="#e2434b">
          <path d="M22 7 Q18 -4 24 -6 Q24 1 28 5 Z" />
          <path d="M44 7 Q48 -4 42 -6 Q42 1 38 5 Z" />
        </g>
      );
    case "cap":
      return (
        <g fill="#3151cb">
          <path d="M22 8 A11 11 0 0 1 44 8 Z" />
          <rect x="33" y="4" width="16" height="4" rx="2" />
        </g>
      );
    case "chef":
      return (
        <g fill="#f2f5fb">
          <rect x="24" y="-8" width="18" height="14" rx="3" />
          <circle cx="27" cy="-8" r="5" />
          <circle cx="33" cy="-10" r="6" />
          <circle cx="39" cy="-8" r="5" />
        </g>
      );
    default:
      return null;
  }
}

'use client';

/** Hand-drawn-style inline SVG icons for inventory items. All original. */

import { ItemId } from '@/game/types';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ItemIcon({ item }: { item: ItemId }) {
  switch (item) {
    case 'key_study':
    case 'key_master':
    case 'key_basement':
    case 'key_car':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <circle cx="16" cy="18" r="8" {...stroke} />
          <path d="M21 24 L36 39 M31 34 l5 -5 M27 30 l4 -4" {...stroke} />
        </svg>
      );
    case 'fuse':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <rect x="18" y="10" width="12" height="28" rx="5" {...stroke} />
          <path d="M24 16 v6 l-4 4 h8 l-4 4 v2" {...stroke} />
        </svg>
      );
    case 'gas_can':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <path d="M12 18 h18 v20 h-18 z M14 18 l4 -6 h10 l2 6 M30 22 l6 -6" {...stroke} />
        </svg>
      );
    case 'crowbar':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <path d="M14 38 L34 18 q4 -4 0 -8 q-4 -3 -7 1 l-2 3" {...stroke} />
        </svg>
      );
    case 'bolt_cutters':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <path
            d="M16 40 L24 22 M32 40 L24 22 M24 22 l-4 -8 M24 22 l4 -8 M20 10 a5 5 0 1 0 4 4"
            {...stroke}
          />
        </svg>
      );
    case 'wire_cutters':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <path d="M18 38 L24 24 M30 38 L24 24 M21 18 a4.5 4.5 0 1 1 6 0 L24 24" {...stroke} />
        </svg>
      );
    case 'battery':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <rect x="16" y="14" width="16" height="26" rx="2" {...stroke} />
          <rect x="21" y="9" width="6" height="5" {...stroke} />
          <path d="M24 22 l-3 6 h6 l-3 6" {...stroke} />
        </svg>
      );
    case 'bandage':
      return (
        <svg viewBox="0 0 48 48" className="item-icon">
          <circle cx="24" cy="24" r="12" {...stroke} />
          <path d="M24 12 a12 12 0 0 1 0 24 M24 16 q6 4 0 8 q-6 4 0 8" {...stroke} />
        </svg>
      );
  }
}

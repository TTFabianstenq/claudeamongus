"use client";

import { getGameClient } from "@/game/client/GameClient";
import { HELION } from "@/shared/map/helion";

interface MiniMapProps {
  showMe?: boolean;
  /** per-room occupancy badge (admin table) */
  occupancy?: Record<string, number> | null;
  onRoomClick?: (roomId: string) => void;
}

/** Scaled-down SVG of the ship used by the sabotage map and admin table. */
export function MiniMap({ showMe = false, occupancy = null, onRoomClick }: MiniMapProps) {
  const map = HELION;
  const me = showMe ? getGameClient()?.myPosition : null;

  return (
    <svg
      viewBox={`0 0 ${map.width} ${map.height}`}
      className="bg-space-950 h-auto w-full rounded-xl"
      role="img"
      aria-label="Map of the HSS Helion"
    >
      {map.corridors.map((c, i) => (
        <rect key={`c${i}`} x={c.x} y={c.y} width={c.w} height={c.h} fill="#1d2334" stroke="#38405c" strokeWidth={4} />
      ))}
      {map.rooms.map((room) => (
        <g key={room.id}>
          <rect
            x={room.rect.x}
            y={room.rect.y}
            width={room.rect.w}
            height={room.rect.h}
            fill={room.tint}
            stroke={onRoomClick && room.sealable ? "#e2434b" : "#38405c"}
            strokeWidth={onRoomClick && room.sealable ? 8 : 4}
            className={onRoomClick && room.sealable ? "cursor-pointer hover:opacity-80" : undefined}
            onClick={onRoomClick ? () => onRoomClick(room.id) : undefined}
            role={onRoomClick && room.sealable ? "button" : undefined}
            aria-label={onRoomClick && room.sealable ? `Seal ${room.name} doors` : room.name}
          />
          <text
            x={room.rect.x + room.rect.w / 2}
            y={room.rect.y + room.rect.h / 2}
            textAnchor="middle"
            fill="#b8c2dc"
            fontSize={34}
            fontWeight={700}
            pointerEvents="none"
          >
            {room.name}
          </text>
          {occupancy && occupancy[room.id] !== undefined && (
            <g pointerEvents="none">
              <circle
                cx={room.rect.x + room.rect.w / 2}
                cy={room.rect.y + room.rect.h / 2 + 52}
                r={36}
                fill="#38c8ef"
              />
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h / 2 + 66}
                textAnchor="middle"
                fill="#05070f"
                fontSize={42}
                fontWeight={900}
              >
                {occupancy[room.id]}
              </text>
            </g>
          )}
        </g>
      ))}
      {me && (
        <g pointerEvents="none">
          <circle cx={me.x} cy={me.y} r={26} fill="#ffd166" stroke="#05070f" strokeWidth={6} />
          <circle cx={me.x} cy={me.y} r={44} fill="none" stroke="#ffd166" strokeWidth={4} opacity={0.5}>
            <animate attributeName="r" values="30;60;30" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </svg>
  );
}

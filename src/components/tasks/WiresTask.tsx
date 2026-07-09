"use client";

import { useMemo, useState } from "react";
import { shuffle } from "@/shared/rng";

const WIRE_COLORS = ["#e2434b", "#3151cb", "#f0e14d", "#ed66bb"];

interface WiresTaskProps {
  onComplete: () => void;
}

/** Connect each left wire to its matching color on the right. */
export function WiresTask({ onComplete }: WiresTaskProps) {
  const rightOrder = useMemo(() => shuffle([0, 1, 2, 3]), []);
  const [connections, setConnections] = useState<Record<number, number>>({});
  const [activeLeft, setActiveLeft] = useState<number | null>(null);

  const connect = (rightSlot: number) => {
    if (activeLeft === null) return;
    const targetColor = rightOrder[rightSlot];
    if (targetColor !== activeLeft) {
      setActiveLeft(null);
      return;
    }
    const next = { ...connections, [activeLeft]: rightSlot };
    setConnections(next);
    setActiveLeft(null);
    if (Object.keys(next).length === 4) {
      setTimeout(onComplete, 350);
    }
  };

  return (
    <div>
      <p className="text-space-400 mb-2 text-sm">
        Tap a wire, then tap its matching colored terminal.
      </p>
      <svg viewBox="0 0 400 260" className="bg-space-950 w-full rounded-xl" role="group" aria-label="Wire panel">
        <rect x="0" y="0" width="400" height="260" fill="#0c0f1c" rx="12" />
        {/* connected wires */}
        {Object.entries(connections).map(([leftStr, rightSlot]) => {
          const left = Number(leftStr);
          const leftIdx = left;
          return (
            <path
              key={left}
              d={`M 60 ${50 + leftIdx * 55} C 200 ${50 + leftIdx * 55}, 200 ${50 + rightSlot * 55}, 340 ${50 + rightSlot * 55}`}
              stroke={WIRE_COLORS[left]}
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
        {/* left stubs */}
        {WIRE_COLORS.map((color, i) => (
          <g key={`l${i}`} onClick={() => setActiveLeft(i)} className="cursor-pointer" role="button" aria-label={`Wire ${i + 1}`}>
            <rect x="10" y={38 + i * 55} width="50" height="24" fill={color} rx="4"
              stroke={activeLeft === i ? "#fff" : "transparent"} strokeWidth={3} />
            <circle cx="60" cy={50 + i * 55} r={activeLeft === i ? 10 : 7} fill={color} />
          </g>
        ))}
        {/* right terminals */}
        {rightOrder.map((colorIdx, slot) => {
          const connected = connections[colorIdx] === slot;
          return (
            <g key={`r${slot}`} onClick={() => connect(slot)} className="cursor-pointer" role="button" aria-label={`Terminal ${slot + 1}`}>
              <rect x="340" y={38 + slot * 55} width="50" height="24" fill={WIRE_COLORS[colorIdx]} rx="4" opacity={connected ? 1 : 0.75} />
              <circle cx="340" cy={50 + slot * 55} r="7" fill={WIRE_COLORS[colorIdx]} />
              {connected && (
                <circle cx="365" cy={50 + slot * 55} r="5" fill="#5fd3a8">
                  <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";

interface AlignEngineTaskProps {
  onComplete: () => void;
}

/** Drag the engine nozzle until it lines up with the target line. */
export function AlignEngineTask({ onComplete }: AlignEngineTaskProps) {
  const initial = useMemo(() => (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 22), []);
  const [angle, setAngle] = useState(initial);
  const [locked, setLocked] = useState(false);
  const dragging = useRef(false);

  const aligned = Math.abs(angle) < 2.5;

  const update = (clientY: number, rect: DOMRect) => {
    if (locked) return;
    const rel = (clientY - rect.top) / rect.height - 0.5;
    setAngle(Math.max(-45, Math.min(45, rel * 90)));
  };

  const release = () => {
    dragging.current = false;
    if (aligned && !locked) {
      setLocked(true);
      setTimeout(onComplete, 450);
    }
  };

  return (
    <div className="py-2">
      <p className="text-space-400 mb-2 text-center text-sm">
        Drag up/down until the engine points along the guide.
      </p>
      <div
        className="bg-space-950 border-space-600 relative mx-auto h-56 w-full max-w-sm touch-none overflow-hidden rounded-xl border"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          update(e.clientY, e.currentTarget.getBoundingClientRect());
        }}
        onPointerMove={(e) => {
          if (dragging.current) update(e.clientY, e.currentTarget.getBoundingClientRect());
        }}
        onPointerUp={release}
        onPointerCancel={release}
        role="slider"
        aria-label="Engine alignment"
        aria-valuenow={Math.round(angle)}
        aria-valuemin={-45}
        aria-valuemax={45}
      >
        <svg viewBox="0 0 400 220" className="h-full w-full">
          {/* guide line */}
          <line
            x1="150"
            y1="110"
            x2="400"
            y2="110"
            stroke="#38405c"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
          {/* engine block */}
          <g transform={`translate(90 110) rotate(${angle})`}>
            <rect
              x="-70"
              y="-42"
              width="90"
              height="84"
              rx="10"
              fill="#2a324c"
              stroke="#46557a"
              strokeWidth="3"
            />
            <rect
              x="18"
              y="-20"
              width="46"
              height="40"
              rx="6"
              fill={locked || aligned ? "#5fd3a8" : "#e2434b"}
            />
            <line
              x1="60"
              y1="0"
              x2="310"
              y2="0"
              stroke={locked || aligned ? "#5fd3a8" : "#e2434b"}
              strokeWidth="4"
            />
            {/* exhaust flame */}
            <path d="M -70 -14 L -100 0 L -70 14 Z" fill="#ffd166">
              <animate
                attributeName="opacity"
                values="1;0.5;1"
                dur="0.4s"
                repeatCount="indefinite"
              />
            </path>
          </g>
          {locked && (
            <text x="200" y="30" textAnchor="middle" fill="#5fd3a8" fontSize="20" fontWeight="900">
              ALIGNED ✓
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

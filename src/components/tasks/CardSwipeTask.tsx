"use client";

import { useRef, useState } from "react";

interface CardSwipeTaskProps {
  onComplete: () => void;
}

type Status = "idle" | "tooFast" | "tooSlow" | "partial" | "accepted";

const MESSAGES: Record<Status, string> = {
  idle: "Please swipe card",
  tooFast: "Too fast. Try again.",
  tooSlow: "Too slow. Try again.",
  partial: "Bad read. Try again.",
  accepted: "Accepted. Thank you!",
};

/** Drag the card across the reader at just the right speed. */
export function CardSwipeTask({ onComplete }: CardSwipeTaskProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [cardX, setCardX] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const drag = useRef<{ startT: number; startX: number; dragging: boolean }>({
    startT: 0,
    startX: 0,
    dragging: false,
  });

  const begin = (clientX: number) => {
    if (status === "accepted") return;
    drag.current = { startT: performance.now(), startX: clientX, dragging: true };
    setStatus("idle");
  };

  const move = (clientX: number) => {
    if (!drag.current.dragging) return;
    const track = trackRef.current?.getBoundingClientRect();
    if (!track) return;
    const maxTravel = track.width - 96;
    const x = Math.max(0, Math.min(maxTravel, clientX - drag.current.startX));
    setCardX(x);
  };

  const end = () => {
    if (!drag.current.dragging) return;
    drag.current.dragging = false;
    const track = trackRef.current?.getBoundingClientRect();
    const maxTravel = (track?.width ?? 300) - 96;
    const elapsed = performance.now() - drag.current.startT;
    if (cardX < maxTravel * 0.95) {
      setStatus("partial");
    } else if (elapsed < 400) {
      setStatus("tooFast");
    } else if (elapsed > 1600) {
      setStatus("tooSlow");
    } else {
      setStatus("accepted");
      setTimeout(onComplete, 500);
      return;
    }
    setCardX(0);
  };

  return (
    <div className="select-none">
      <p
        className={`mb-3 rounded-lg px-3 py-2 text-center font-mono text-sm font-bold ${
          status === "accepted"
            ? "bg-mint-400/20 text-mint-400"
            : status === "idle"
              ? "bg-space-900 text-space-200"
              : "bg-danger-500/20 text-danger-500"
        }`}
        role="status"
      >
        {MESSAGES[status]}
      </p>
      <div
        ref={trackRef}
        className="bg-space-950 border-space-600 relative h-28 overflow-hidden rounded-xl border"
      >
        <div className="bg-space-700 absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 rounded" />
        <div
          className="border-space-600 absolute top-3 bottom-3 left-2 w-24 cursor-grab touch-none rounded-lg border-2 bg-gradient-to-br from-slate-100 to-slate-300 shadow-lg active:cursor-grabbing"
          style={{ transform: `translateX(${cardX}px)` }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            begin(e.clientX);
          }}
          onPointerMove={(e) => move(e.clientX)}
          onPointerUp={end}
          onPointerCancel={end}
          role="slider"
          aria-label="ID card"
          aria-valuenow={Math.round(cardX)}
        >
          <div className="bg-warn-400 mx-2 mt-2 h-4 rounded-sm" />
          <div className="bg-space-700 mx-2 mt-2 h-2 w-12 rounded-sm" />
          <div className="bg-space-700 mx-2 mt-1 h-2 w-8 rounded-sm" />
        </div>
      </div>
      <p className="text-space-400 mt-2 text-center text-xs">Not too fast, not too slow.</p>
    </div>
  );
}

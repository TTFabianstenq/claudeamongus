"use client";

import { useEffect, useRef, useState } from "react";

interface FuelTaskProps {
  onComplete: () => void;
}

/** Hold the button to pump fuel until the tank is full. */
export function FuelTask({ onComplete }: FuelTaskProps) {
  const [level, setLevel] = useState(0);
  const [holding, setHolding] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!holding || doneRef.current) return;
    const timer = setInterval(() => {
      setLevel((l) => {
        const next = Math.min(100, l + 1.2);
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          setTimeout(onComplete, 400);
        }
        return next;
      });
    }, 33);
    return () => clearInterval(timer);
  }, [holding, onComplete]);

  return (
    <div className="flex items-center justify-center gap-8 py-2">
      <div
        className="border-space-600 bg-space-950 relative h-52 w-24 overflow-hidden rounded-xl border-2"
        role="progressbar"
        aria-valuenow={Math.round(level)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fuel level"
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-600 to-yellow-400 transition-all"
          style={{ height: `${level}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-black/50 px-2 py-0.5 font-mono text-sm font-bold text-white">
            {Math.floor(level)}%
          </span>
        </div>
      </div>
      <button
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onKeyDown={(e) => {
          if (e.code === "Space" || e.code === "Enter") setHolding(true);
        }}
        onKeyUp={() => setHolding(false)}
        className={`h-24 w-24 touch-none rounded-full border-4 text-sm font-black transition-all cursor-pointer ${
          holding
            ? "border-mint-400 bg-mint-400/30 text-mint-400 scale-95"
            : "border-danger-500 bg-danger-500/20 text-danger-500"
        }`}
        aria-label="Hold to pump fuel"
      >
        {holding ? "PUMPING" : "HOLD"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/shared/rng";

interface GarbageTaskProps {
  onComplete: () => void;
}

/** Hold the lever down until all the junk is flushed out of the chute. */
export function GarbageTask({ onComplete }: GarbageTaskProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);
  const junk = useMemo(() => {
    const rng = mulberry32(42);
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: 12 + rng() * 76,
      y: 12 + rng() * 60,
      r: 4 + rng() * 8,
      hue: Math.floor(rng() * 360),
    }));
  }, []);

  useEffect(() => {
    if (!holding || doneRef.current) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.022);
        if (next >= 1 && !doneRef.current) {
          doneRef.current = true;
          setTimeout(onComplete, 400);
        }
        return next;
      });
    }, 33);
    return () => clearInterval(timer);
  }, [holding, onComplete]);

  return (
    <div className="flex items-center justify-center gap-6 py-2">
      <div className="bg-space-950 border-space-600 relative h-52 w-44 overflow-hidden rounded-xl border-2">
        {/* junk falls as progress increases */}
        {junk.map((j) => (
          <div
            key={j.id}
            className="absolute rounded-sm"
            style={{
              left: `${j.x}%`,
              top: `${j.y + progress * 130}%`,
              width: j.r * 2,
              height: j.r * 2,
              backgroundColor: `hsl(${j.hue} 40% 45%)`,
              transition: "top 0.2s linear",
              transform: `rotate(${j.id * 47}deg)`,
            }}
          />
        ))}
        {/* chute hatch */}
        <div
          className="bg-space-700 absolute inset-x-0 bottom-0 h-4 transition-transform"
          style={{ transform: holding ? "translateY(16px)" : "translateY(0)" }}
        />
        {progress >= 1 && (
          <p
            className="text-mint-400 absolute inset-0 flex items-center justify-center font-black"
            role="status"
          >
            CLEAR ✓
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onKeyDown={(e) => {
            if (e.code === "Space" || e.code === "Enter") setHolding(true);
          }}
          onKeyUp={() => setHolding(false)}
          className="border-space-600 bg-space-700 relative h-40 w-16 touch-none rounded-xl border-2 cursor-pointer"
          aria-label="Hold lever to flush garbage"
        >
          <span
            className={`bg-warn-400 absolute left-1/2 h-14 w-8 -translate-x-1/2 rounded-lg shadow-md transition-all ${
              holding ? "top-[calc(100%-4rem)]" : "top-2"
            }`}
          />
        </button>
        <span className="text-space-400 text-xs font-bold">HOLD LEVER</span>
      </div>
    </div>
  );
}

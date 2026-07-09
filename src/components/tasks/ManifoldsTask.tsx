"use client";

import { useMemo, useRef, useState } from "react";
import { shuffle } from "@/shared/rng";

interface ManifoldsTaskProps {
  onComplete: () => void;
}

/** Press 1 through 10 in order. A wrong press resets the sequence. */
export function ManifoldsTask({ onComplete }: ManifoldsTaskProps) {
  const layout = useMemo(() => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), []);
  const [next, setNext] = useState(1);
  const [shake, setShake] = useState(false);
  const doneRef = useRef(false);

  const press = (n: number) => {
    if (doneRef.current) return;
    if (n === next) {
      if (n === 10) {
        doneRef.current = true;
        setNext(11);
        setTimeout(onComplete, 400);
      } else {
        setNext(n + 1);
      }
    } else if (n > next) {
      setNext(1);
      setShake(true);
      setTimeout(() => setShake(false), 350);
    }
  };

  return (
    <div className="py-2">
      <p className="text-space-400 mb-3 text-center text-sm">Press the numbers in order.</p>
      <div
        className={`mx-auto grid max-w-sm grid-cols-5 gap-2 ${shake ? "animate-[wiggle_0.3s_ease-in-out]" : ""}`}
        style={shake ? { transform: "translateX(0)" } : undefined}
        role="group"
        aria-label="Manifold buttons"
      >
        {layout.map((n) => {
          const pressed = n < next;
          return (
            <button
              key={n}
              onClick={() => press(n)}
              disabled={pressed}
              className={`aspect-square rounded-xl text-xl font-black transition-all cursor-pointer ${
                pressed
                  ? "bg-mint-400 text-space-950"
                  : shake
                    ? "bg-danger-500/60 text-white"
                    : "bg-space-700 hover:bg-space-600 text-white active:scale-90"
              }`}
              aria-label={`Manifold ${n}${pressed ? " (done)" : ""}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {next > 10 && (
        <p className="text-mint-400 mt-3 text-center font-black" role="status">
          MANIFOLDS UNLOCKED
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

interface AsteroidsTaskProps {
  onComplete: () => void;
}

interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  hit: boolean;
}

const TARGET = 12;

/** Click the drifting asteroids before they float past the viewport. */
export function AsteroidsTask({ onComplete }: AsteroidsTaskProps) {
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [destroyed, setDestroyed] = useState(0);
  const nextId = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const spawner = setInterval(() => {
      setAsteroids((list) => {
        if (list.filter((a) => !a.hit).length >= 4) return list;
        const id = nextId.current++;
        return [
          ...list,
          {
            id,
            x: 105,
            y: 12 + Math.random() * 76,
            vx: -(6 + Math.random() * 7),
            vy: (Math.random() - 0.5) * 4,
            r: 6 + Math.random() * 7,
            rot: Math.random() * 360,
            hit: false,
          },
        ];
      });
    }, 750);
    const mover = setInterval(() => {
      setAsteroids((list) =>
        list
          .map((a) => ({ ...a, x: a.x + a.vx * 0.06, y: a.y + a.vy * 0.06, rot: a.rot + 1.2 }))
          .filter((a) => a.x > -12 && !(a.hit && a.x < -5)),
      );
    }, 32);
    return () => {
      clearInterval(spawner);
      clearInterval(mover);
    };
  }, []);

  const shoot = (id: number) => {
    if (doneRef.current) return;
    setAsteroids((list) => list.filter((a) => a.id !== id));
    setDestroyed((d) => {
      const next = d + 1;
      if (next >= TARGET && !doneRef.current) {
        doneRef.current = true;
        setTimeout(onComplete, 400);
      }
      return next;
    });
  };

  return (
    <div className="py-1">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-space-400 text-sm">Destroy the asteroids!</p>
        <p className="font-mono text-sm font-black text-white" aria-live="polite">
          {Math.min(destroyed, TARGET)}/{TARGET}
        </p>
      </div>
      <div className="starfield bg-space-950 border-space-600 relative h-64 w-full cursor-crosshair overflow-hidden rounded-xl border">
        {asteroids.map((a) => (
          <button
            key={a.id}
            onClick={() => shoot(a.id)}
            className="absolute cursor-crosshair"
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              transform: `translate(-50%, -50%) rotate(${a.rot}deg)`,
            }}
            aria-label="Asteroid"
          >
            <svg width={a.r * 4} height={a.r * 4} viewBox="-20 -20 40 40">
              <path
                d="M -14 -4 L -8 -14 L 4 -16 L 14 -8 L 16 4 L 8 14 L -4 15 L -13 8 Z"
                fill="#6b6558"
                stroke="#4a463c"
                strokeWidth="2.5"
              />
              <circle cx="-4" cy="-3" r="3.5" fill="#4a463c" />
              <circle cx="6" cy="5" r="2.5" fill="#4a463c" />
            </svg>
          </button>
        ))}
        {destroyed >= TARGET && (
          <p
            className="text-mint-400 absolute inset-0 flex items-center justify-center text-xl font-black"
            role="status"
          >
            FIELD CLEAR ✓
          </p>
        )}
      </div>
    </div>
  );
}

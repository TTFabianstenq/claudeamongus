"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SimonTaskProps {
  onComplete: () => void;
}

const ROUNDS = 5;
const PADS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Reactor start sequence: watch the pattern, repeat it. Five rounds. */
export function SimonTask({ onComplete }: SimonTaskProps) {
  const sequence = useMemo(
    () => Array.from({ length: ROUNDS }, () => Math.floor(Math.random() * 9)),
    [],
  );
  const [round, setRound] = useState(1);
  const [showing, setShowing] = useState(true);
  const [litPad, setLitPad] = useState<number | null>(null);
  const [inputIndex, setInputIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const doneRef = useRef(false);
  const timeouts = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const playback = useCallback(
    (upTo: number) => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      setShowing(true);
      setInputIndex(0);
      for (let i = 0; i < upTo; i++) {
        timeouts.current.push(
          setTimeout(() => setLitPad(sequence[i] ?? 0), 600 + i * 550),
          setTimeout(() => setLitPad(null), 600 + i * 550 + 350),
        );
      }
      timeouts.current.push(setTimeout(() => setShowing(false), 600 + upTo * 550));
    },
    [sequence],
  );

  useEffect(() => {
    playback(round);
    const current = timeouts.current;
    return () => current.forEach(clearTimeout);
  }, [round, playback]);

  const press = (pad: number) => {
    if (showing || doneRef.current) return;
    if (sequence[inputIndex] === pad) {
      setLitPad(pad);
      setTimeout(() => setLitPad(null), 200);
      const nextIndex = inputIndex + 1;
      if (nextIndex >= round) {
        if (round >= ROUNDS) {
          doneRef.current = true;
          setTimeout(onComplete, 500);
        } else {
          setTimeout(() => setRound((r) => r + 1), 600);
          setShowing(true);
        }
      } else {
        setInputIndex(nextIndex);
      }
    } else {
      setFailed(true);
      setTimeout(() => {
        setFailed(false);
        playback(round);
      }, 700);
    }
  };

  return (
    <div className="py-2">
      <div className="mb-3 flex items-center justify-center gap-1.5" aria-label={`Round ${round} of ${ROUNDS}`}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < round - 1 || doneRef.current ? "bg-mint-400" : i === round - 1 ? "bg-accent-400" : "bg-space-600"}`}
          />
        ))}
      </div>
      <p className="text-space-400 mb-3 text-center text-sm" role="status">
        {failed ? "Wrong pad! Watch again…" : showing ? "Watch the sequence…" : "Repeat the sequence."}
      </p>
      <div className="mx-auto grid w-full max-w-64 grid-cols-3 gap-2" role="group" aria-label="Reactor pads">
        {PADS.map((pad) => (
          <button
            key={pad}
            onClick={() => press(pad)}
            disabled={showing}
            className={`aspect-square rounded-xl border-2 transition-all cursor-pointer ${
              litPad === pad
                ? "bg-accent-400 border-accent-400 scale-95"
                : failed
                  ? "bg-danger-500/40 border-danger-500"
                  : "bg-space-700 border-space-600 hover:border-accent-400"
            }`}
            aria-label={`Pad ${pad + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

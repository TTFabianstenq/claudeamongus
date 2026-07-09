"use client";

import { useEffect, useRef, useState } from "react";

interface DownloadTaskProps {
  mode: "download" | "upload";
  onComplete: () => void;
}

const DURATION_MS = 4600;

/** Start the transfer and wait for it to finish. */
export function DownloadTask({ mode, onComplete }: DownloadTaskProps) {
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!started) return;
    const startAt = performance.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (performance.now() - startAt) / DURATION_MS);
      setProgress(p);
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(timer);
        setTimeout(onComplete, 400);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [started, onComplete]);

  const eta = Math.ceil(((1 - progress) * DURATION_MS) / 1000);

  return (
    <div className="py-2 text-center">
      <div className="bg-space-950 border-space-600 mx-auto mb-4 flex h-36 w-full max-w-sm flex-col items-center justify-center rounded-xl border font-mono">
        {!started ? (
          <>
            <p className="text-space-200 mb-1 text-3xl">{mode === "download" ? "⬇" : "⬆"}</p>
            <p className="text-space-400 text-sm">
              {mode === "download" ? "Data ready to download" : "Data ready to upload"}
            </p>
          </>
        ) : (
          <>
            <p className="text-accent-400 mb-2 animate-pulse text-3xl">
              {mode === "download" ? "⬇" : "⬆"}
            </p>
            <div
              className="bg-space-700 h-3 w-56 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-accent-400 h-full transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-space-400 mt-2 text-xs">
              {progress >= 1 ? "Complete!" : `Estimated time: ${eta}s`}
            </p>
          </>
        )}
      </div>
      {!started && (
        <button
          onClick={() => setStarted(true)}
          className="bg-accent-500 text-space-950 rounded-xl px-6 py-2.5 font-black hover:brightness-110 cursor-pointer"
        >
          Start {mode}
        </button>
      )}
    </div>
  );
}

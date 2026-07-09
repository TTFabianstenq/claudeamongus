"use client";

import { useEffect, useMemo, useState } from "react";
import { emitAck, getSocket } from "@/game/net/socket";
import { useGameStore } from "@/game/store/gameStore";
import { soundManager } from "@/game/audio/SoundManager";

interface FixProps {
  panelId: string;
  onDone: () => void;
}

/** Lights: flip every breaker back on, then the panel reports fixed. */
export function LightsFix({ panelId, onDone }: FixProps) {
  const [switches, setSwitches] = useState(() =>
    Array.from({ length: 5 }, () => Math.random() < 0.5),
  );
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (switches.every(Boolean) && !sent) {
      setSent(true);
      const socket = getSocket();
      if (!socket) return;
      void emitAck(socket, "game:fix", { kind: "lights", panelId }).then((res) => {
        if (res.ok) soundManager.play("task");
        onDone();
      });
    }
  }, [switches, sent, panelId, onDone]);

  return (
    <div className="py-2">
      <p className="text-space-400 mb-4 text-center text-sm">Flip every breaker up.</p>
      <div className="bg-space-950 border-space-600 mx-auto flex max-w-sm justify-center gap-3 rounded-xl border p-5">
        {switches.map((on, i) => (
          <button
            key={i}
            onClick={() =>
              setSwitches((s) => s.map((v, idx) => (idx === i ? !v : v)))
            }
            className="flex flex-col items-center gap-2 cursor-pointer"
            aria-pressed={on}
            aria-label={`Breaker ${i + 1}`}
          >
            <span className={`h-3 w-3 rounded-full ${on ? "bg-mint-400" : "bg-space-600"}`} />
            <span className="border-space-600 bg-space-800 relative h-16 w-9 rounded-lg border-2">
              <span
                className={`absolute left-1/2 h-6 w-6 -translate-x-1/2 rounded-md transition-all ${
                  on ? "bg-warn-400 top-1" : "bg-space-600 top-8"
                }`}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Reactor: hold your pad; a second crewmate must hold the other pad. */
export function ReactorFix({ panelId, onDone }: FixProps) {
  const sabotage = useGameStore((s) => s.sabotage);
  const [holding, setHolding] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sabotage || sabotage.kind !== "reactor") {
      const socket = getSocket();
      if (socket && holding) socket.emit("game:fixRelease", { kind: "reactor", panelId });
      onDone();
    }
  }, [sabotage, holding, panelId, onDone]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    if (holding) socket.emit("game:fixHold", { kind: "reactor", panelId });
    else socket.emit("game:fixRelease", { kind: "reactor", panelId });
    return () => {
      socket.emit("game:fixRelease", { kind: "reactor", panelId });
    };
  }, [holding, panelId]);

  const secondsLeft = sabotage?.deadline ? Math.max(0, Math.ceil((sabotage.deadline - now) / 1000)) : 0;
  const otherPanel = panelId === "fix-reactor-a" ? "fix-reactor-b" : "fix-reactor-a";
  const otherHeld = sabotage?.fixed[otherPanel] ?? false;

  return (
    <div className="py-2 text-center">
      <p className="text-danger-500 mb-1 font-mono text-3xl font-black" aria-live="assertive">
        {secondsLeft}s
      </p>
      <p className="text-space-400 mb-4 text-sm">
        Hold your hand on the scanner. Both scanners must be held at once.
      </p>
      <button
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onKeyDown={(e) => {
          if (e.code === "Space" || e.code === "Enter") setHolding(true);
        }}
        onKeyUp={() => setHolding(false)}
        className={`mx-auto flex h-36 w-36 touch-none items-center justify-center rounded-2xl border-4 transition-all cursor-pointer ${
          holding ? "border-mint-400 bg-mint-400/20 scale-95" : "border-danger-500 bg-danger-500/10"
        }`}
        aria-pressed={holding}
        aria-label="Hold scanner"
      >
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12v6a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-6Z"
            stroke={holding ? "#5fd3a8" : "#e2434b"}
            strokeWidth="1.6"
          />
        </svg>
      </button>
      <p className={`mt-3 text-sm font-bold ${otherHeld ? "text-mint-400" : "text-space-400"}`}>
        Other scanner: {otherHeld ? "HELD ✓" : "waiting…"}
      </p>
    </div>
  );
}

/** O2: type the code from the sticky note into the keypad. */
export function O2Fix({ panelId, onDone }: FixProps) {
  const code = useMemo(() => String(Math.floor(10000 + Math.random() * 90000)), []);
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const [sent, setSent] = useState(false);

  const press = (digit: string) => {
    if (sent) return;
    if (digit === "C") {
      setEntry("");
      return;
    }
    if (digit === "✓") {
      if (entry === code) {
        setSent(true);
        const socket = getSocket();
        if (!socket) return;
        void emitAck(socket, "game:fix", { kind: "o2", panelId }).then((res) => {
          if (res.ok) soundManager.play("task");
          onDone();
        });
      } else {
        setWrong(true);
        setEntry("");
        setTimeout(() => setWrong(false), 600);
      }
      return;
    }
    if (entry.length < 5) setEntry(entry + digit);
  };

  return (
    <div className="flex flex-wrap items-start justify-center gap-5 py-2">
      <div className="bg-warn-400 text-space-950 rotate-[-3deg] rounded-md p-3 font-mono shadow-lg">
        <p className="text-[10px] font-bold uppercase">O2 code:</p>
        <p className="text-xl font-black tracking-widest">{code}</p>
      </div>
      <div>
        <div
          className={`mb-2 h-10 w-44 rounded-lg border-2 text-center font-mono text-xl font-black leading-9 ${
            wrong ? "border-danger-500 text-danger-500" : "border-space-600 bg-space-950 text-mint-400"
          }`}
          aria-live="polite"
        >
          {wrong ? "ERROR" : entry.padEnd(5, "•")}
        </div>
        <div className="grid w-44 grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "✓"].map((key) => (
            <button
              key={key}
              onClick={() => press(key)}
              className={`aspect-square rounded-lg text-lg font-black transition-all active:scale-90 cursor-pointer ${
                key === "✓"
                  ? "bg-mint-400 text-space-950"
                  : key === "C"
                    ? "bg-danger-500 text-white"
                    : "bg-space-700 text-white hover:bg-space-600"
              }`}
              aria-label={key === "C" ? "Clear" : key === "✓" ? "Submit" : key}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Comms: drag the dial until the static resolves into a clean signal. */
export function CommsFix({ panelId, onDone }: FixProps) {
  const target = useMemo(() => 15 + Math.random() * 70, []);
  const [value, setValue] = useState(50);
  const [sent, setSent] = useState(false);
  const distance = Math.abs(value - target);
  const locked = distance < 2;

  useEffect(() => {
    if (locked && !sent) {
      const timer = setTimeout(() => {
        setSent(true);
        const socket = getSocket();
        if (!socket) return;
        void emitAck(socket, "game:fix", { kind: "comms", panelId }).then((res) => {
          if (res.ok) soundManager.play("task");
          onDone();
        });
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [locked, sent, panelId, onDone]);

  const noise = Math.min(1, distance / 40);

  return (
    <div className="py-2">
      <div className="bg-space-950 border-space-600 mx-auto mb-4 h-24 w-full max-w-sm overflow-hidden rounded-xl border">
        <svg viewBox="0 0 400 96" className="h-full w-full" aria-hidden="true">
          <polyline
            points={Array.from({ length: 80 }, (_, i) => {
              const x = i * 5;
              const clean = Math.sin(i * 0.45) * 26;
              const jitter = (Math.sin(i * 7.3) + Math.sin(i * 13.7)) * 22 * noise;
              return `${x},${48 + clean * (1 - noise) + jitter}`;
            }).join(" ")}
            fill="none"
            stroke={locked ? "#5fd3a8" : "#7ce7ff"}
            strokeWidth="2.5"
          />
        </svg>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
        aria-label="Frequency dial"
        disabled={sent}
      />
      <p className={`mt-2 text-center text-sm font-black ${locked ? "text-mint-400" : "text-space-400"}`} role="status">
        {locked ? "SIGNAL LOCKED ✓" : "Tune the frequency…"}
      </p>
    </div>
  );
}

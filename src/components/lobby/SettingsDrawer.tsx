"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RoomSettings } from "@/shared/types";
import { emitAck, getSocket } from "@/game/net/socket";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { Button } from "@/components/ui/Button";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Host-only match configuration. Mirrors the server's settings schema. */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const lobby = useLobbyStore((s) => s.lobby);
  const [draft, setDraft] = useState<RoomSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && lobby) setDraft({ ...lobby.settings });
  }, [open, lobby]);

  if (!lobby) return null;

  const save = async () => {
    const socket = getSocket();
    if (!socket || !draft) return;
    const res = await emitAck(socket, "lobby:settings", draft);
    if (!res.ok) {
      setError(res.error ?? "Could not save settings");
      return;
    }
    setError(null);
    onClose();
  };

  const set = <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  return (
    <AnimatePresence>
      {open && draft && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Game settings"
        >
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="bg-space-800 border-space-600 flex h-full w-full max-w-md flex-col border-l"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-space-600 flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-black text-white">Game settings</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <Slider label="Impostors" value={draft.impostorCount} min={1} max={3} step={1} onChange={(v) => set("impostorCount", v)} />
              <Slider label="Max players" value={draft.maxPlayers} min={4} max={15} step={1} onChange={(v) => set("maxPlayers", v)} />
              <Slider label="Player speed" value={draft.playerSpeed} min={0.5} max={3} step={0.25} suffix="×" onChange={(v) => set("playerSpeed", v)} />
              <Slider label="Crew vision" value={draft.crewVision} min={0.25} max={5} step={0.25} suffix="×" onChange={(v) => set("crewVision", v)} />
              <Slider label="Impostor vision" value={draft.impostorVision} min={0.25} max={5} step={0.25} suffix="×" onChange={(v) => set("impostorVision", v)} />
              <Slider label="Kill cooldown" value={draft.killCooldown} min={10} max={60} step={2.5} suffix="s" onChange={(v) => set("killCooldown", v)} />
              <Select
                label="Kill range"
                value={draft.killRange}
                options={[
                  { value: "short", label: "Short" },
                  { value: "normal", label: "Normal" },
                  { value: "long", label: "Long" },
                ]}
                onChange={(v) => set("killRange", v as RoomSettings["killRange"])}
              />
              <Slider label="Discussion time" value={draft.discussionTime} min={0} max={120} step={15} suffix="s" onChange={(v) => set("discussionTime", v)} />
              <Slider label="Voting time" value={draft.votingTime} min={15} max={300} step={15} suffix="s" onChange={(v) => set("votingTime", v)} />
              <Slider label="Emergency meetings" value={draft.emergencyMeetings} min={0} max={9} step={1} onChange={(v) => set("emergencyMeetings", v)} />
              <Slider label="Common tasks" value={draft.commonTasks} min={0} max={2} step={1} onChange={(v) => set("commonTasks", v)} />
              <Slider label="Short tasks" value={draft.shortTasks} min={0} max={5} step={1} onChange={(v) => set("shortTasks", v)} />
              <Slider label="Long tasks" value={draft.longTasks} min={0} max={3} step={1} onChange={(v) => set("longTasks", v)} />
              <Toggle label="Visual tasks" hint="Garbage & asteroids show proof to others" value={draft.visualTasks} onChange={(v) => set("visualTasks", v)} />
              <Toggle label="Confirm ejects" hint="Reveal whether the ejected player was an impostor" value={draft.confirmEjects} onChange={(v) => set("confirmEjects", v)} />
              <Toggle label="Anonymous votes" hint="Hide who voted for whom" value={draft.anonymousVotes} onChange={(v) => set("anonymousVotes", v)} />
              <Toggle label="Public room" hint="Show this lobby in the public browser" value={draft.isPublic} onChange={(v) => set("isPublic", v)} />
            </div>

            <div className="border-space-600 border-t p-4">
              {error && (
                <p role="alert" className="text-danger-500 mb-2 text-sm font-bold">
                  {error}
                </p>
              )}
              <Button className="w-full" onClick={() => void save()}>
                Save settings
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm">
        <span className="text-space-200 font-semibold">{label}</span>
        <span className="text-accent-400 font-mono font-bold">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
        aria-label={label}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-space-200 text-sm font-semibold">{label}</span>
      <div className="mt-1 flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
              value === opt.value ? "bg-accent-500 text-space-950" : "bg-space-700 text-space-400"
            }`}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </label>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-space-200 text-sm font-semibold">{label}</p>
        {hint && <p className="text-space-400 text-xs">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer ${
          value ? "bg-accent-500" : "bg-space-600"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            value ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

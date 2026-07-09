"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getGameClient } from "@/game/client/GameClient";
import { useGameStore } from "@/game/store/gameStore";
import { soundManager } from "@/game/audio/SoundManager";

/** All non-canvas in-game UI: task bar, task list, action buttons, alerts. */
export function GameHud() {
  const role = useGameStore((s) => s.role);
  const tasks = useGameStore((s) => s.tasks);
  const taskBar = useGameStore((s) => s.taskBar);
  const sabotage = useGameStore((s) => s.sabotage);
  const context = useGameStore((s) => s.context);
  const amDead = useGameStore((s) => s.amDead);
  const inVentId = useGameStore((s) => s.inVentId);
  const killCooldownAt = useGameStore((s) => s.killCooldownAt);
  const emergenciesLeft = useGameStore((s) => s.emergenciesLeft);
  const meeting = useGameStore((s) => s.meeting);
  const setOpenPanel = useGameStore((s) => s.setOpenPanel);
  const openPanel = useGameStore((s) => s.openPanel);
  const [now, setNow] = useState(Date.now());
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setShowBanner(true);
    const timer = setTimeout(() => setShowBanner(false), 3500);
    return () => clearTimeout(timer);
  }, [role]);

  if (meeting) return null;

  const killSecondsLeft = Math.max(0, Math.ceil((killCooldownAt - now) / 1000));
  const doneCount = tasks.filter((t) => t.done).length;
  const sabotageDeadline = sabotage?.deadline
    ? Math.max(0, Math.ceil((sabotage.deadline - now) / 1000))
    : null;

  const useLabel =
    context.useTarget?.type === "task" || context.useTarget?.type === "fix"
      ? context.useTarget.label
      : context.useTarget?.type === "emergency"
        ? "Emergency"
        : context.useTarget?.type === "admin"
          ? "Admin Map"
          : context.useTarget?.type === "cameras"
            ? "Cameras"
            : "Use";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* role banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="absolute left-1/2 top-16 -translate-x-1/2 text-center"
          >
            <p
              className={`text-3xl font-black tracking-widest drop-shadow-lg sm:text-5xl ${
                role === "impostor" ? "text-danger-500" : "text-accent-400"
              }`}
            >
              {role === "impostor" ? "IMPOSTOR" : "CREWMATE"}
            </p>
            <p className="text-space-200 mt-1 text-sm font-semibold drop-shadow">
              {role === "impostor"
                ? "Kill the crew. Sabotage. Don't get caught."
                : "Finish your tasks and find the impostors."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* top bar: global task progress */}
      <div className="absolute left-1/2 top-3 w-[min(480px,90vw)] -translate-x-1/2">
        <div
          className="bg-space-900/80 border-space-600 h-5 overflow-hidden rounded-full border backdrop-blur"
          role="progressbar"
          aria-valuenow={Math.round(taskBar * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Total task progress"
        >
          <motion.div
            className="bg-mint-400 h-full"
            animate={{ width: `${taskBar * 100}%` }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          />
        </div>
      </div>

      {/* sabotage alert */}
      <AnimatePresence>
        {sabotage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: [1, 1.04, 1] }}
            exit={{ opacity: 0 }}
            transition={{ scale: { repeat: Infinity, duration: 1 } }}
            className="bg-danger-500/90 absolute left-1/2 top-12 -translate-x-1/2 rounded-xl px-5 py-2 text-center backdrop-blur"
            role="alert"
          >
            <p className="font-black text-white">
              {sabotage.kind === "reactor" && `⚠ REACTOR MELTDOWN — ${sabotageDeadline}s`}
              {sabotage.kind === "o2" && `⚠ OXYGEN DEPLETED — ${sabotageDeadline}s`}
              {sabotage.kind === "lights" && "⚠ LIGHTS SABOTAGED"}
              {sabotage.kind === "comms" && "⚠ COMMS DOWN"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* task list */}
      <div className="absolute left-3 top-3 w-[min(300px,70vw)]">
        <details className="pointer-events-auto" open>
          <summary className="bg-space-900/80 border-space-600 text-space-200 cursor-pointer rounded-t-xl border px-3 py-1.5 text-sm font-bold backdrop-blur">
            {role === "impostor" ? "Fake tasks" : "Tasks"} ({doneCount}/{tasks.length})
          </summary>
          <ul className="bg-space-900/70 border-space-600 max-h-56 space-y-1 overflow-y-auto rounded-b-xl border border-t-0 p-2 text-sm backdrop-blur">
            {tasks.map((task) => {
              const map = getGameClient()?.map;
              const consoleId = task.consoleIds[Math.min(task.stage, task.consoleIds.length - 1)];
              const room = map?.consoles.find((c) => c.id === consoleId)?.roomId ?? "";
              const roomName = map?.rooms.find((r) => r.id === room)?.name ?? "";
              return (
                <li
                  key={task.id}
                  className={task.done ? "text-mint-400 line-through" : "text-space-200"}
                >
                  {roomName ? `${roomName}: ` : ""}
                  {taskName(task.kind)}
                  {task.consoleIds.length > 1 &&
                    !task.done &&
                    ` (${task.stage}/${task.consoleIds.length})`}
                </li>
              );
            })}
            {role === "impostor" && (
              <li className="text-danger-500/90 pt-1 text-xs">
                These are fake — pretend to work them.
              </li>
            )}
          </ul>
        </details>
      </div>

      {/* status chips */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        {amDead && (
          <span className="bg-space-900/80 border-space-600 text-space-200 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur">
            👻 You are a ghost{role === "crewmate" ? " — tasks still count!" : ""}
          </span>
        )}
        {inVentId && (
          <span className="bg-space-900/80 border-space-600 text-warn-400 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur">
            In vent — E to exit
          </span>
        )}
        {!amDead && role === "crewmate" && (
          <span className="bg-space-900/80 border-space-600 text-space-400 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur">
            Emergency meetings left: {emergenciesLeft}
          </span>
        )}
      </div>

      {/* action buttons */}
      <div className="absolute bottom-4 right-3 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          {!amDead && context.reportBodyId && (
            <ActionButton
              label="Report"
              keyHint="R"
              color="warn"
              onClick={() => void getGameClient()?.reportAction()}
            />
          )}
          {role === "impostor" && !amDead && (
            <>
              <ActionButton
                label={killSecondsLeft > 0 ? `Kill (${killSecondsLeft})` : "Kill"}
                keyHint="Q"
                color="danger"
                disabled={killSecondsLeft > 0 || !context.killTargetId}
                onClick={() => void getGameClient()?.killAction()}
              />
              <ActionButton
                label={inVentId ? "Exit vent" : "Vent"}
                keyHint="V"
                color="ghost"
                disabled={!inVentId && !context.ventId}
                onClick={() => void getGameClient()?.ventAction()}
              />
              <ActionButton
                label="Sabotage"
                keyHint="F"
                color="danger"
                onClick={() => {
                  soundManager.play("click");
                  setOpenPanel(openPanel?.type === "sabotage" ? null : { type: "sabotage" });
                }}
              />
            </>
          )}
          <ActionButton
            label={useLabel}
            keyHint="E"
            color="primary"
            disabled={!context.useTarget}
            onClick={() => void getGameClient()?.useAction()}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  keyHint,
  color,
  disabled,
  onClick,
}: {
  label: string;
  keyHint: string;
  color: "primary" | "danger" | "warn" | "ghost";
  disabled?: boolean;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    primary: "bg-accent-500 text-space-950",
    danger: "bg-danger-500 text-white",
    warn: "bg-warn-400 text-space-950",
    ghost: "bg-space-700 text-space-200 border border-space-600",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colors[color]} relative min-w-24 rounded-2xl px-4 py-3 text-base font-black shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed`}
    >
      {label}
      <span className="absolute -top-1.5 -right-1.5 hidden rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white sm:block">
        {keyHint}
      </span>
    </button>
  );
}

function taskName(kind: string): string {
  const names: Record<string, string> = {
    wires: "Fix Wiring",
    cardSwipe: "Swipe Card",
    fuelEngine: "Fuel Engine",
    download: "Download Data",
    upload: "Upload Data",
    alignEngine: "Align Engine",
    unlockManifolds: "Unlock Manifolds",
    startReactor: "Start Reactor",
    garbage: "Empty Garbage",
    asteroids: "Clear Asteroids",
  };
  return names[kind] ?? kind;
}

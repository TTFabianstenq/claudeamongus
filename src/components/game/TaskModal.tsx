"use client";

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TaskKind } from "@/shared/types";
import { emitAck, getSocket } from "@/game/net/socket";
import { useGameStore } from "@/game/store/gameStore";
import { soundManager } from "@/game/audio/SoundManager";
import { WiresTask } from "@/components/tasks/WiresTask";
import { CardSwipeTask } from "@/components/tasks/CardSwipeTask";
import { FuelTask } from "@/components/tasks/FuelTask";
import { DownloadTask } from "@/components/tasks/DownloadTask";
import { AlignEngineTask } from "@/components/tasks/AlignEngineTask";
import { ManifoldsTask } from "@/components/tasks/ManifoldsTask";
import { SimonTask } from "@/components/tasks/SimonTask";
import { GarbageTask } from "@/components/tasks/GarbageTask";
import { AsteroidsTask } from "@/components/tasks/AsteroidsTask";
import { LightsFix, ReactorFix, O2Fix, CommsFix } from "@/components/tasks/FixPanels";

const TITLES: Record<TaskKind, string> = {
  wires: "Fix Wiring",
  cardSwipe: "Swipe Card",
  fuelEngine: "Fuel Engine",
  download: "Download Data",
  upload: "Upload Data",
  alignEngine: "Align Engine Output",
  unlockManifolds: "Unlock Manifolds",
  startReactor: "Start Reactor Sequence",
  garbage: "Empty Garbage",
  asteroids: "Clear Asteroids",
};

/** Modal host for task minigames and sabotage fix panels. */
export function TaskModal() {
  const openPanel = useGameStore((s) => s.openPanel);
  const setOpenPanel = useGameStore((s) => s.setOpenPanel);

  const close = useCallback(() => {
    if (useGameStore.getState().openPanel?.type === "task") {
      getSocket()?.emit("game:taskClose");
    }
    setOpenPanel(null);
  }, [setOpenPanel]);

  const completeTask = useCallback(async () => {
    const panel = useGameStore.getState().openPanel;
    if (panel?.type !== "task") return;
    const socket = getSocket();
    if (!socket) return;
    const res = await emitAck(socket, "game:taskComplete", { taskId: panel.taskId });
    if (res.ok) soundManager.play("task");
    setOpenPanel(null);
  }, [setOpenPanel]);

  const isTask = openPanel?.type === "task";
  const isFix = openPanel?.type === "fix";
  if (!isTask && !isFix) return null;

  const title = isTask
    ? TITLES[openPanel.kind]
    : openPanel.kind === "lights"
      ? "Restore Lights"
      : openPanel.kind === "reactor"
        ? "Stabilize Reactor"
        : openPanel.kind === "o2"
          ? "Enter O2 Code"
          : "Retune Communications";

  return (
    <AnimatePresence>
      <motion.div
        key="task-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-space-800 border-space-600 w-full max-w-lg rounded-2xl border-2 p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black text-white">{title}</h3>
            <button
              onClick={close}
              className="text-space-400 hover:text-white text-sm font-bold cursor-pointer"
              aria-label="Close task"
            >
              ✕ close
            </button>
          </div>

          {isTask && (
            <>
              {openPanel.kind === "wires" && <WiresTask onComplete={completeTask} />}
              {openPanel.kind === "cardSwipe" && <CardSwipeTask onComplete={completeTask} />}
              {openPanel.kind === "fuelEngine" && <FuelTask onComplete={completeTask} />}
              {openPanel.kind === "download" && <DownloadTask mode="download" onComplete={completeTask} />}
              {openPanel.kind === "upload" && <DownloadTask mode="upload" onComplete={completeTask} />}
              {openPanel.kind === "alignEngine" && <AlignEngineTask onComplete={completeTask} />}
              {openPanel.kind === "unlockManifolds" && <ManifoldsTask onComplete={completeTask} />}
              {openPanel.kind === "startReactor" && <SimonTask onComplete={completeTask} />}
              {openPanel.kind === "garbage" && <GarbageTask onComplete={completeTask} />}
              {openPanel.kind === "asteroids" && <AsteroidsTask onComplete={completeTask} />}
            </>
          )}
          {isFix && (
            <>
              {openPanel.kind === "lights" && <LightsFix panelId={openPanel.panelId} onDone={() => setOpenPanel(null)} />}
              {openPanel.kind === "reactor" && <ReactorFix panelId={openPanel.panelId} onDone={() => setOpenPanel(null)} />}
              {openPanel.kind === "o2" && <O2Fix panelId={openPanel.panelId} onDone={() => setOpenPanel(null)} />}
              {openPanel.kind === "comms" && <CommsFix panelId={openPanel.panelId} onDone={() => setOpenPanel(null)} />}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

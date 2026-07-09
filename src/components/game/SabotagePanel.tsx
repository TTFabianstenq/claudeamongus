"use client";

import { AnimatePresence, motion } from "framer-motion";
import { getGameClient } from "@/game/client/GameClient";
import { emitAck, getSocket } from "@/game/net/socket";
import { useGameStore } from "@/game/store/gameStore";
import { soundManager } from "@/game/audio/SoundManager";
import { MiniMap } from "@/components/game/MiniMap";

const SABOTAGES = [
  { kind: "lights" as const, label: "Lights", icon: "💡", room: "electrical" },
  { kind: "reactor" as const, label: "Reactor", icon: "☢", room: "reactor" },
  { kind: "o2" as const, label: "Oxygen", icon: "🫧", room: "o2" },
  { kind: "comms" as const, label: "Comms", icon: "📡", room: "comms" },
];

/**
 * Impostor sabotage map: trigger a system sabotage or seal a room's doors.
 * Crewmates open the same panel via M/Tab but only see the map.
 */
export function SabotagePanel() {
  const openPanel = useGameStore((s) => s.openPanel);
  const setOpenPanel = useGameStore((s) => s.setOpenPanel);
  const role = useGameStore((s) => s.role);
  const sabotage = useGameStore((s) => s.sabotage);
  const amDead = useGameStore((s) => s.amDead);
  const client = getGameClient();
  const open = openPanel?.type === "sabotage";
  const isImpostor = role === "impostor" && !amDead;

  const trigger = async (kind: "lights" | "reactor" | "o2" | "comms") => {
    const socket = getSocket();
    if (!socket) return;
    const res = await emitAck(socket, "game:sabotage", { kind });
    if (res.ok) {
      soundManager.play("sabotage");
      setOpenPanel(null);
    }
  };

  const closeDoors = async (roomId: string) => {
    const socket = getSocket();
    if (!socket) return;
    const res = await emitAck(socket, "game:doorSabotage", { roomId });
    if (res.ok) soundManager.play("door");
  };

  return (
    <AnimatePresence>
      {open && client && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-3"
          onClick={() => setOpenPanel(null)}
          role="dialog"
          aria-modal="true"
          aria-label={isImpostor ? "Sabotage map" : "Ship map"}
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            className="bg-space-900 border-space-600 w-full max-w-3xl rounded-2xl border-2 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className={`text-lg font-black ${isImpostor ? "text-danger-500" : "text-white"}`}>
                {isImpostor ? "SABOTAGE" : "SHIP MAP"}
              </h3>
              <button
                className="text-space-400 hover:text-white font-bold cursor-pointer"
                onClick={() => setOpenPanel(null)}
                aria-label="Close map"
              >
                ✕ close
              </button>
            </div>
            <MiniMap
              showMe
              onRoomClick={
                isImpostor
                  ? (roomId) => {
                      const room = client.map.rooms.find((r) => r.id === roomId);
                      if (room?.sealable) void closeDoors(roomId);
                    }
                  : undefined
              }
            />
            {isImpostor && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SABOTAGES.map((s) => (
                    <button
                      key={s.kind}
                      onClick={() => void trigger(s.kind)}
                      disabled={sabotage !== null}
                      className="bg-danger-600/40 border-danger-500/60 hover:bg-danger-600/70 rounded-xl border px-3 py-2.5 font-bold text-white transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-space-400 mt-2 text-xs">
                  Tap a highlighted room on the map to seal its doors. One system sabotage at a
                  time; sabotage cooldown applies.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { Bean } from "@/components/ui/Bean";

const REASON_TEXT: Record<string, string> = {
  tasksComplete: "All tasks completed",
  impostorsEjected: "All impostors ejected",
  impostorsDominate: "The impostors took over",
  sabotageMeltdown: "Critical sabotage was not fixed",
  crewQuit: "The crew abandoned ship",
  impostorQuit: "The impostors abandoned ship",
};

export function GameOverOverlay() {
  const gameOver = useGameStore((s) => s.gameOver);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);

  return (
    <AnimatePresence>
      {gameOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/92 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Game over"
        >
          {(() => {
            const me = gameOver.players.find((p) => p.id === myPlayerId);
            const iAmImpostor = me?.role === "impostor";
            const iWon = (gameOver.winners === "impostors") === iAmImpostor;
            const winnerList = gameOver.players.filter(
              (p) => (gameOver.winners === "impostors") === (p.role === "impostor"),
            );
            return (
              <>
                <motion.h2
                  initial={{ scale: 2.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 14 }}
                  className={`text-5xl font-black tracking-widest sm:text-7xl ${
                    iWon ? "text-accent-400" : "text-danger-500"
                  }`}
                >
                  {iWon ? "VICTORY" : "DEFEAT"}
                </motion.h2>
                <p className="text-space-200 -mt-3 text-center text-lg font-bold">
                  {gameOver.winners === "crew" ? "The crew wins!" : "The impostors win!"}
                  <span className="text-space-400 block text-sm font-semibold">
                    {REASON_TEXT[gameOver.reason] ?? gameOver.reason}
                  </span>
                </p>
                <div className="flex max-w-2xl flex-wrap items-end justify-center gap-3">
                  {winnerList.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ y: 60, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.12 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <Bean color={p.color} size={i === 0 ? 84 : 64} dead={!p.alive} />
                      <span className={`text-xs font-bold ${p.role === "impostor" ? "text-danger-500" : "text-space-200"}`}>
                        {p.name}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <div className="text-space-400 bg-space-800/70 border-space-600 rounded-xl border px-4 py-2 text-center text-sm">
                  Impostor{gameOver.impostorIds.length > 1 ? "s were" : " was"}:{" "}
                  <span className="text-danger-500 font-bold">
                    {gameOver.players
                      .filter((p) => p.role === "impostor")
                      .map((p) => p.name)
                      .join(", ")}
                  </span>
                </div>
                <p className="text-space-400 animate-pulse text-sm font-semibold">
                  Returning to the lobby…
                </p>
              </>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

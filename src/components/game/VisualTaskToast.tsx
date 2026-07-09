"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/game/store/gameStore";

/** Broadcast proof for visual tasks ("X emptied the garbage"). */
export function VisualTaskToast() {
  const toast = useGameStore((s) => s.visualToast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-mint-400/90 text-space-950 absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-black shadow-xl"
          role="status"
        >
          {toast.kind === "garbage" ? "🗑" : "☄"} {toast.playerName} completed a visual task
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/game/store/gameStore";
import { MiniMap } from "@/components/game/MiniMap";

/** The admin table: live occupancy per room while standing at the console. */
export function AdminPanel() {
  const openPanel = useGameStore((s) => s.openPanel);
  const setOpenPanel = useGameStore((s) => s.setOpenPanel);
  const admin = useGameStore((s) => s.admin);
  const sabotage = useGameStore((s) => s.sabotage);
  const open = openPanel?.type === "admin";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-3"
          onClick={() => setOpenPanel(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Admin table"
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            className="bg-space-900 border-space-600 w-full max-w-3xl rounded-2xl border-2 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">ADMIN — LIFE SIGNS</h3>
              <button
                className="text-space-400 hover:text-white font-bold cursor-pointer"
                onClick={() => setOpenPanel(null)}
                aria-label="Close admin table"
              >
                ✕ close
              </button>
            </div>
            {sabotage?.kind === "comms" ? (
              <p className="text-danger-500 py-16 text-center font-black">
                SIGNAL LOST — COMMS SABOTAGED
              </p>
            ) : admin ? (
              <MiniMap occupancy={admin} />
            ) : (
              <p className="text-space-400 py-16 text-center text-sm font-bold">
                Stand at the admin table to read life signs…
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

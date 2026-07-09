"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/game/store/gameStore";
import { Bean } from "@/components/ui/Bean";

/** Shown to the victim for a couple of seconds after being killed. */
export function KillOverlay() {
  const killCam = useGameStore((s) => s.killCam);
  const playersMeta = useGameStore((s) => s.playersMeta);

  return (
    <AnimatePresence>
      {killCam && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/90"
          role="alert"
        >
          <div className="flex items-end gap-6">
            <motion.div
              initial={{ x: -80, scale: 1 }}
              animate={{ x: 0, scale: 1.15 }}
              transition={{ type: "spring", damping: 12 }}
            >
              <Bean
                color={playersMeta[killCam.killerId]?.color ?? "red"}
                hat={playersMeta[killCam.killerId]?.hat}
                size={140}
              />
            </motion.div>
            <motion.div
              initial={{ rotate: 0, y: 0 }}
              animate={{ rotate: 78, y: 46 }}
              transition={{ delay: 0.25, duration: 0.5, ease: "easeIn" }}
            >
              <Bean
                color={playersMeta[killCam.victimId]?.color ?? "blue"}
                hat={playersMeta[killCam.victimId]?.hat}
                size={110}
                dead
              />
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-danger-500 absolute top-[24%] left-1/2 -translate-x-1/2 text-4xl font-black tracking-widest sm:text-6xl"
          >
            YOU DIED
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="text-space-400 absolute bottom-[22%] left-1/2 -translate-x-1/2 text-center text-sm font-bold"
          >
            You are a ghost now — finish your tasks and haunt responsibly.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

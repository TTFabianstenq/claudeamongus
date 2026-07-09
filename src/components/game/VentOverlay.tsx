"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ventById } from "@/shared/map/helion";
import { getGameClient } from "@/game/client/GameClient";
import { useGameStore } from "@/game/store/gameStore";

/** Arrow buttons to travel between linked vents while inside one. */
export function VentOverlay() {
  const inVentId = useGameStore((s) => s.inVentId);
  const client = getGameClient();
  if (!client) return null;
  const vent = inVentId ? ventById(client.map, inVentId) : null;

  return (
    <AnimatePresence>
      {vent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2"
          role="group"
          aria-label="Vent travel"
        >
          <div className="bg-space-900/90 border-space-600 flex items-center gap-2 rounded-2xl border p-2 backdrop-blur">
            {vent.links.map((linkId) => {
              const target = ventById(client.map, linkId);
              if (!target) return null;
              const room = client.map.rooms.find((r) => r.id === target.roomId);
              return (
                <button
                  key={linkId}
                  onClick={() => void client.ventMoveTo(linkId)}
                  className="bg-space-700 hover:bg-space-600 text-space-200 rounded-xl px-4 py-2.5 text-sm font-black transition-colors cursor-pointer"
                >
                  → {room?.name ?? linkId}
                </button>
              );
            })}
            <button
              onClick={() => void client.ventAction()}
              className="bg-warn-400 text-space-950 rounded-xl px-4 py-2.5 text-sm font-black cursor-pointer"
            >
              Pop out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

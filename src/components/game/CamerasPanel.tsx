"use client";

import { AnimatePresence, motion } from "framer-motion";
import { colorHex } from "@/shared/constants";
import { HELION } from "@/shared/map/helion";
import { useGameStore } from "@/game/store/gameStore";

/** Security camera wall: four live feeds while at the security console. */
export function CamerasPanel() {
  const openPanel = useGameStore((s) => s.openPanel);
  const setOpenPanel = useGameStore((s) => s.setOpenPanel);
  const cameras = useGameStore((s) => s.cameras);
  const sabotage = useGameStore((s) => s.sabotage);
  const open = openPanel?.type === "cameras";

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
          aria-label="Security cameras"
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            className="bg-space-900 border-space-600 w-full max-w-3xl rounded-2xl border-2 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black text-white">
                <span className="bg-danger-500 inline-block h-2.5 w-2.5 animate-pulse rounded-full" />
                SECURITY FEED
              </h3>
              <button
                className="text-space-400 hover:text-white font-bold cursor-pointer"
                onClick={() => setOpenPanel(null)}
                aria-label="Close cameras"
              >
                ✕ close
              </button>
            </div>
            {sabotage?.kind === "comms" ? (
              <p className="text-danger-500 py-16 text-center font-black">
                NO SIGNAL — COMMS SABOTAGED
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {HELION.cameras.map((cam) => {
                  const feed = cameras?.find((f) => f.camId === cam.id);
                  return (
                    <div
                      key={cam.id}
                      className="border-space-600 relative aspect-video overflow-hidden rounded-lg border bg-black"
                    >
                      <div className="absolute left-2 top-1.5 z-10 text-[10px] font-black tracking-widest text-white/70">
                        {cam.label.toUpperCase()}
                      </div>
                      {cameras ? (
                        <svg viewBox="-240 -135 480 270" className="h-full w-full">
                          <rect x={-240} y={-135} width={480} height={270} fill="#0c1120" />
                          <rect x={-240} y={-135} width={480} height={270} fill="url(#scan)" opacity={0.15} />
                          <defs>
                            <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stopColor="#7ce7ff" />
                              <stop offset="1" stopColor="transparent" />
                            </linearGradient>
                          </defs>
                          {(feed?.players ?? []).map((p, i) => (
                            <g key={i} transform={`translate(${p.x}, ${p.y})`}>
                              <ellipse cx={0} cy={12} rx={13} ry={5} fill="rgba(0,0,0,0.5)" />
                              <path
                                d="M-11 8 L-11 -6 Q-11 -18 0 -18 Q12 -18 12 -5 L12 8 Q12 13 6 13 L-6 13 Q-11 13 -11 8 Z"
                                fill={colorHex(p.color)}
                              />
                              <ellipse cx={5} cy={-8} rx={7} ry={5} fill="#9fdcef" />
                            </g>
                          ))}
                          {feed && feed.players.length === 0 && (
                            <text x={0} y={4} textAnchor="middle" fill="#3a4568" fontSize={20} fontWeight={700}>
                              no movement
                            </text>
                          )}
                        </svg>
                      ) : (
                        <p className="text-space-400 flex h-full items-center justify-center text-xs font-bold">
                          Stand at the console to view…
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

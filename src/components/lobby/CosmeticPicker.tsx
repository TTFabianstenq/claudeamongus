"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HATS, PLAYER_COLORS, type HatId, type PlayerColorId } from "@/shared/constants";
import { emitAck, getSocket } from "@/game/net/socket";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { useSessionStore } from "@/game/store/sessionStore";
import { Bean } from "@/components/ui/Bean";
import { Button } from "@/components/ui/Button";

interface CosmeticPickerProps {
  open: boolean;
  onClose: () => void;
}

export function CosmeticPicker({ open, onClose }: CosmeticPickerProps) {
  const lobby = useLobbyStore((s) => s.lobby);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);
  const session = useSessionStore();
  const me = lobby?.players.find((p) => p.id === myPlayerId);

  const takenColors = new Set(
    (lobby?.players ?? []).filter((p) => p.id !== myPlayerId).map((p) => p.color),
  );

  const apply = async (color: PlayerColorId, hat: HatId) => {
    const socket = getSocket();
    if (!socket) return;
    const res = await emitAck(socket, "lobby:cosmetic", { color, hat });
    if (res.ok) {
      session.setColor(color);
      session.setHat(hat);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Cosmetics"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            className="bg-space-800 border-space-600 w-full max-w-lg rounded-2xl border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-white">Wardrobe</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
            <div className="mb-5 flex justify-center">
              <Bean color={me?.color ?? session.color} hat={me?.hat ?? session.hat} size={110} />
            </div>
            <p className="text-space-400 mb-2 text-sm font-bold">Suit color</p>
            <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Suit color">
              {PLAYER_COLORS.map((c) => {
                const taken = takenColors.has(c.id);
                const selected = (me?.color ?? session.color) === c.id;
                return (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${c.name}${taken ? " (taken)" : ""}`}
                    disabled={taken}
                    onClick={() => void apply(c.id, me?.hat ?? session.hat)}
                    className={`relative h-10 w-10 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30 ${
                      selected ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {taken && (
                      <span className="absolute inset-0 flex items-center justify-center text-lg">
                        ✕
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-space-400 mb-2 text-sm font-bold">Hat</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Hat">
              {HATS.map((h) => (
                <button
                  key={h.id}
                  role="radio"
                  aria-checked={(me?.hat ?? session.hat) === h.id}
                  aria-label={h.name}
                  title={h.name}
                  onClick={() => void apply(me?.color ?? session.color, h.id)}
                  className={`bg-space-900 rounded-xl border p-1.5 transition-colors cursor-pointer ${
                    (me?.hat ?? session.hat) === h.id ? "border-accent-400" : "border-space-600"
                  }`}
                >
                  <Bean color={me?.color ?? session.color} hat={h.id} size={38} />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

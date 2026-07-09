"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { connectSocket } from "@/game/net/socket";
import { soundManager } from "@/game/audio/SoundManager";
import { useGameStore } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { useSessionStore } from "@/game/store/sessionStore";
import { LobbyView } from "@/components/lobby/LobbyView";
import { GameView } from "@/components/game/GameView";

/**
 * /play hosts the whole match lifecycle: lobby -> countdown -> game ->
 * meetings -> game over -> back to lobby. All socket -> store bindings
 * live in game/net/bindings.ts and are attached at connection time, so
 * nothing is missed while this route mounts.
 */
export default function PlayPage() {
  const router = useRouter();
  const lobby = useLobbyStore((s) => s.lobby);
  const status = useLobbyStore((s) => s.status);
  const resume = useLobbyStore((s) => s.resume);
  const inGame = useGameStore((s) => s.inGame);
  const name = useSessionStore((s) => s.name);
  const sfxVolume = useSessionStore((s) => s.sfxVolume);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    soundManager.setVolume(sfxVolume);
  }, [sfxVolume]);

  useEffect(() => {
    let cancelled = false;
    connectSocket(name || "Guest")
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [name, router]);

  // no room and nothing to resume -> back to the home screen
  useEffect(() => {
    if (ready && !lobby && !resume && status !== "connecting" && status !== "reconnecting") {
      const timer = setTimeout(() => {
        if (!useLobbyStore.getState().lobby && !useLobbyStore.getState().resume) {
          router.replace("/");
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ready, lobby, resume, status, router]);

  const showGame =
    inGame &&
    (lobby?.phase === "playing" || lobby?.phase === "meeting" || lobby?.phase === "ended");

  return (
    <main className="bg-space-950 relative h-dvh w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!lobby ? (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="starfield flex h-full items-center justify-center"
          >
            <div className="text-center">
              <div className="border-accent-400 mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-space-200 text-lg font-bold">
                {status === "reconnecting" ? "Reconnecting to the Helion…" : "Boarding the Helion…"}
              </p>
            </div>
          </motion.div>
        ) : showGame ? (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <GameView />
          </motion.div>
        ) : (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="h-full"
          >
            <LobbyView />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

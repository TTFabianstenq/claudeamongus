"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MIN_PLAYERS_TO_START } from "@/shared/constants";
import { getSocket, emitAck } from "@/game/net/socket";
import { useGameStore } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { soundManager } from "@/game/audio/SoundManager";
import { Bean } from "@/components/ui/Bean";
import { Button } from "@/components/ui/Button";
import { ChatPanel } from "@/components/lobby/ChatPanel";
import { CosmeticPicker } from "@/components/lobby/CosmeticPicker";
import { SettingsDrawer } from "@/components/lobby/SettingsDrawer";

export function LobbyView() {
  const router = useRouter();
  const lobby = useLobbyStore((s) => s.lobby);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);
  const clearRoom = useLobbyStore((s) => s.clearRoom);
  const lastError = useLobbyStore((s) => s.lastError);
  const setError = useLobbyStore((s) => s.setError);
  const resetGame = useGameStore((s) => s.reset);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (!lobby) return null;
  const me = lobby.players.find((p) => p.id === myPlayerId);
  const isHost = lobby.hostId === myPlayerId;
  const everyoneReady = lobby.players.filter((p) => !p.isHost).every((p) => p.ready);
  const enoughPlayers = lobby.players.length >= MIN_PLAYERS_TO_START;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — code is still visible on screen
    }
  };

  const toggleReady = () => {
    const socket = getSocket();
    if (!socket || !me) return;
    soundManager.unlock();
    soundManager.play("click");
    socket.emit("lobby:ready", { ready: !me.ready });
  };

  const startGame = async () => {
    const socket = getSocket();
    if (!socket) return;
    soundManager.unlock();
    const res = await emitAck(socket, "lobby:start");
    if (!res.ok) setStartError(res.error ?? "Could not start");
    else setStartError(null);
  };

  const leave = () => {
    getSocket()?.emit("room:leave");
    clearRoom();
    resetGame();
    router.replace("/");
  };

  return (
    <div className="starfield mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-space-400 text-xs font-bold tracking-widest uppercase">
            Private lobby
          </p>
          <button
            onClick={() => void copyCode()}
            className="group flex items-center gap-2 cursor-pointer"
            title="Copy room code"
          >
            <span className="font-mono text-3xl font-black tracking-[0.25em] text-white">
              {lobby.code}
            </span>
            <span className="text-accent-400 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
              {copied ? "COPIED!" : "COPY"}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              ⚙ Game settings
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setCosmeticsOpen(true)}>
            🎨 Cosmetics
          </Button>
          <Button variant="danger" size="sm" onClick={leave}>
            Leave
          </Button>
        </div>
      </header>

      {lobby.countdown !== null && (
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-danger-500/20 border-danger-500 rounded-2xl border p-4 text-center"
          role="status"
        >
          <p className="text-2xl font-black text-white">Launching in {lobby.countdown}…</p>
          <p className="text-space-200 text-sm">Assigning roles. No takebacks.</p>
        </motion.div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section
          className="bg-space-800/70 border-space-600 rounded-2xl border p-5 backdrop-blur"
          aria-label="Players"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Crew ({lobby.players.length}/{lobby.settings.maxPlayers})
            </h2>
            <span className="text-space-400 text-sm">
              {lobby.settings.impostorCount} impostor{lobby.settings.impostorCount > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <AnimatePresence>
              {lobby.players.map((player) => (
                <motion.li
                  key={player.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`bg-space-900/70 relative flex flex-col items-center gap-1 rounded-xl border p-3 ${
                    player.ready || player.isHost ? "border-mint-400/60" : "border-space-600"
                  } ${!player.connected ? "opacity-40" : ""}`}
                >
                  {player.isHost && (
                    <span className="bg-warn-400 text-space-950 absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-black">
                      HOST
                    </span>
                  )}
                  <Bean color={player.color} hat={player.hat} size={52} />
                  <span className="max-w-full truncate text-sm font-bold text-white">
                    {player.name}
                    {player.id === myPlayerId && <span className="text-accent-400"> (you)</span>}
                  </span>
                  <span
                    className={`text-xs font-semibold ${player.ready || player.isHost ? "text-mint-400" : "text-space-400"}`}
                  >
                    {!player.connected
                      ? "reconnecting…"
                      : player.isHost
                        ? "host"
                        : player.ready
                          ? "ready"
                          : "not ready"}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-5 flex flex-col items-center gap-2">
            {isHost ? (
              <>
                <Button
                  size="lg"
                  onClick={() => void startGame()}
                  disabled={!enoughPlayers || !everyoneReady || lobby.countdown !== null}
                  className="w-full sm:w-auto"
                >
                  Start game
                </Button>
                <p className="text-space-400 text-xs">
                  {!enoughPlayers
                    ? `Need ${MIN_PLAYERS_TO_START - lobby.players.length} more player(s)`
                    : !everyoneReady
                      ? "Waiting for everyone to ready up…"
                      : "All set — good luck, captain."}
                </p>
              </>
            ) : (
              <Button
                size="lg"
                variant={me?.ready ? "ghost" : "primary"}
                onClick={toggleReady}
                className="w-full sm:w-auto"
              >
                {me?.ready ? "Unready" : "Ready up"}
              </Button>
            )}
            {(startError ?? lastError) && (
              <p role="alert" className="text-danger-500 text-sm font-bold">
                {startError ?? lastError}
                <button
                  className="text-space-400 ml-2 underline cursor-pointer"
                  onClick={() => {
                    setStartError(null);
                    setError(null);
                  }}
                >
                  dismiss
                </button>
              </p>
            )}
          </div>
        </section>

        <section className="flex min-h-64 flex-col" aria-label="Lobby chat">
          <ChatPanel channelLabel="Lobby chat" />
        </section>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CosmeticPicker open={cosmeticsOpen} onClose={() => setCosmeticsOpen(false)} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { GameEvent } from "@/shared/types";
import { connectSocket, getSocket } from "@/game/net/socket";
import { createGameClient, getGameClient } from "@/game/client/GameClient";
import { soundManager } from "@/game/audio/SoundManager";
import { useGameStore, type PlayerMeta } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { useSessionStore } from "@/game/store/sessionStore";
import { LobbyView } from "@/components/lobby/LobbyView";
import { GameView } from "@/components/game/GameView";

/**
 * /play hosts the whole match lifecycle: lobby -> countdown -> game ->
 * meetings -> game over -> back to lobby. Socket events are bound here
 * exactly once and fan out into the zustand stores.
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

    const boot = async () => {
      try {
        const socket = await connectSocket(name || "Guest");
        if (cancelled) return;
        const lobbyStore = useLobbyStore.getState();
        const gameStore = useGameStore.getState();

        socket.off("room:state");
        socket.on("room:state", (state) => {
          useLobbyStore.getState().setLobby(state);
        });

        socket.off("room:closed");
        socket.on("room:closed", () => {
          useLobbyStore.getState().clearRoom();
          useGameStore.getState().reset();
        });

        socket.off("game:starting");
        socket.on("game:starting", () => {
          soundManager.play("meeting");
        });

        socket.off("game:started");
        socket.on("game:started", (payload) => {
          const meta: Record<string, PlayerMeta> = {};
          for (const p of payload.players) meta[p.id] = p;
          useGameStore.getState().clearChat();
          useGameStore.getState().startGame({
            role: payload.role,
            mates: payload.mates,
            tasks: payload.tasks,
            settings: payload.settings,
            playersMeta: meta,
          });
          const client = getGameClient() ?? createGameClient(socket);
          client.start(payload, useLobbyStore.getState().myPlayerId ?? "");
        });

        socket.off("game:taskUpdate");
        socket.on("game:taskUpdate", ({ tasks }) => {
          useGameStore.getState().setTasks(tasks);
          soundManager.play("task");
        });

        socket.off("game:event");
        socket.on("game:event", (event: GameEvent) => handleGameEvent(event));

        socket.off("game:over");
        socket.on("game:over", (payload) => {
          const store = useGameStore.getState();
          store.setMeeting(null);
          store.setOpenPanel(null);
          store.setGameOver(payload);
          const myId = useLobbyStore.getState().myPlayerId;
          const me = payload.players.find((p) => p.id === myId);
          const iWon = me && (payload.winners === "impostors") === (me.role === "impostor");
          soundManager.play(iWon ? "victory" : "defeat");
        });

        socket.off("chat:message");
        socket.on("chat:message", (message) => {
          useGameStore.getState().addChat(message);
        });

        socket.off("server:error");
        socket.on("server:error", ({ message }) => {
          useLobbyStore.getState().setError(message);
        });

        void lobbyStore;
        void gameStore;
        setReady(true);
      } catch {
        if (!cancelled) router.replace("/");
      }
    };

    void boot();
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

  const showGame = inGame && (lobby?.phase === "playing" || lobby?.phase === "meeting" || lobby?.phase === "ended");

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

function handleGameEvent(event: GameEvent): void {
  const store = useGameStore.getState();
  const myId = useLobbyStore.getState().myPlayerId;
  switch (event.type) {
    case "playerKilled": {
      if (event.victimId === myId) {
        store.setAmDead(true);
        store.setKillCam({ killerId: event.killerId, victimId: event.victimId });
        soundManager.play("kill");
        setTimeout(() => useGameStore.getState().setKillCam(null), 2600);
      } else if (event.killerId === myId) {
        soundManager.play("kill");
      }
      break;
    }
    case "bodyReported": {
      soundManager.play("report");
      break;
    }
    case "emergencyCalled": {
      soundManager.play("meeting");
      break;
    }
    case "meetingUpdate": {
      const prev = store.meeting;
      store.setOpenPanel(null);
      store.setInVent(null);
      store.setMeeting(event.meeting);
      if (!prev) soundManager.play("meeting");
      if (prev?.stage !== event.meeting.stage && event.meeting.stage === "results") {
        soundManager.play("vote");
      }
      if (prev?.stage !== event.meeting.stage && event.meeting.stage === "eject") {
        soundManager.play("eject");
      }
      break;
    }
    case "playerEjected": {
      if (event.playerId === myId) store.setAmDead(true);
      break;
    }
    case "meetingEnded": {
      store.setMeeting(null);
      break;
    }
    case "taskProgress": {
      if (event.visual) {
        const who = store.playersMeta[event.visual.playerId];
        store.setVisualToast({ kind: event.visual.kind, playerName: who?.name ?? "Someone" });
        setTimeout(() => useGameStore.getState().setVisualToast(null), 3500);
      }
      break;
    }
    case "sabotageStarted": {
      soundManager.play("sabotage");
      break;
    }
    case "sabotageFixed": {
      soundManager.play("task");
      break;
    }
    case "doorsClosed": {
      soundManager.play("door");
      break;
    }
    case "playerVented": {
      soundManager.play("vent");
      break;
    }
    case "playerLeft":
    case "playerDisconnected":
    case "sabotageProgress":
      break;
    default:
      break;
  }
}

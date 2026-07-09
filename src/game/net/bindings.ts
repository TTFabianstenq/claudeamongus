"use client";

import type { GameEvent } from "@/shared/types";
import type { GameSocket } from "@/game/net/socket";
import { createGameClient, getGameClient } from "@/game/client/GameClient";
import { soundManager } from "@/game/audio/SoundManager";
import { useGameStore, type PlayerMeta } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";

/**
 * Binds every server -> client event to the stores exactly once, at
 * connection time. Doing this here (not in a React effect) means no event
 * can be missed while a page transition is in flight — the `room:state`
 * that follows a join is already handled before the /play route mounts.
 */
export function bindSocketHandlers(socket: GameSocket): void {
  socket.on("room:state", (state) => {
    useLobbyStore.getState().setLobby(state);
  });

  socket.on("room:closed", () => {
    useLobbyStore.getState().clearRoom();
    useGameStore.getState().reset();
  });

  socket.on("game:starting", () => {
    soundManager.play("meeting");
  });

  socket.on("game:started", (payload) => {
    const meta: Record<string, PlayerMeta> = {};
    for (const p of payload.players) meta[p.id] = p;
    const gameStore = useGameStore.getState();
    gameStore.clearChat();
    gameStore.startGame({
      role: payload.role,
      mates: payload.mates,
      tasks: payload.tasks,
      settings: payload.settings,
      playersMeta: meta,
    });
    const client = getGameClient() ?? createGameClient(socket);
    client.start(payload, useLobbyStore.getState().myPlayerId ?? "");
  });

  socket.on("game:taskUpdate", ({ tasks }) => {
    useGameStore.getState().setTasks(tasks);
    soundManager.play("task");
  });

  socket.on("game:event", (event: GameEvent) => handleGameEvent(event));

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

  socket.on("chat:message", (message) => {
    useGameStore.getState().addChat(message);
  });

  socket.on("server:error", ({ message }) => {
    useLobbyStore.getState().setError(message);
  });
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

"use client";

import { io, type Socket } from "socket.io-client";
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@/shared/protocol";
import { loadResume, useLobbyStore } from "@/game/store/lobbyStore";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let connecting: Promise<GameSocket> | null = null;

async function fetchToken(guestName: string): Promise<string> {
  const res = await fetch("/api/socket-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ guestName: guestName || "Guest" }),
  });
  if (!res.ok) throw new Error("Could not obtain a session token");
  const data = (await res.json()) as { token: string };
  return data.token;
}

/**
 * Lazily connects the singleton game socket. Handles token refresh on
 * reconnect and automatic room re-entry (`room:rejoin`) after transport
 * drops, so a wifi blip or page refresh puts the player back in the match.
 */
export async function connectSocket(guestName: string): Promise<GameSocket> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const store = useLobbyStore.getState();
    store.setStatus("connecting");
    const token = await fetchToken(guestName);
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;

    const s: GameSocket = io(url ?? "", {
      path: "/socket",
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });

    s.io.on("reconnect_attempt", () => {
      useLobbyStore.getState().setStatus("reconnecting");
      // tokens are short-lived; refresh before the handshake retries
      void fetchToken(guestName).then((fresh) => {
        (s.auth as { token: string }).token = fresh;
      });
    });

    s.on("connect", () => {
      const lobbyStore = useLobbyStore.getState();
      lobbyStore.setStatus("connected");
      const resume = lobbyStore.resume ?? loadResume();
      if (resume) {
        s.emit("room:rejoin", resume, (res) => {
          if (res.ok && res.data) {
            lobbyStore.setJoined({
              code: res.data.code,
              playerId: res.data.playerId,
              resumeToken: res.data.resumeToken,
            });
          } else {
            lobbyStore.clearRoom();
          }
        });
      }
    });

    s.on("disconnect", () => {
      useLobbyStore.getState().setStatus("reconnecting");
    });
    s.on("connect_error", () => {
      useLobbyStore.getState().setStatus("error");
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Connection timed out")), 10_000);
      s.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      s.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("Connection failed"));
      });
    });

    socket = s;
    return s;
  })();

  try {
    return await connecting;
  } catch (error) {
    useLobbyStore.getState().setStatus("error");
    throw error;
  } finally {
    connecting = null;
  }
}

export function getSocket(): GameSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  useLobbyStore.getState().setStatus("idle");
}

/** Promise wrapper around socket.io acks with a safety timeout. */
export function emitAck<TData>(
  s: GameSocket,
  event: keyof ClientToServerEvents,
  ...args: unknown[]
): Promise<Ack<TData>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: "Server did not respond" }), 8000);
    (s as Socket).emit(event as string, ...args, (res: Ack<TData>) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

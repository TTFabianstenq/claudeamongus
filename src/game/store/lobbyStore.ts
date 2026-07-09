"use client";

import { create } from "zustand";
import type { LobbyState, PublicRoomInfo } from "@/shared/types";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface ResumeInfo {
  code: string;
  playerId: string;
  resumeToken: string;
}

interface LobbyStoreState {
  status: ConnectionStatus;
  lobby: LobbyState | null;
  myPlayerId: string | null;
  resume: ResumeInfo | null;
  publicRooms: PublicRoomInfo[];
  lastError: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setLobby: (lobby: LobbyState | null) => void;
  setJoined: (info: ResumeInfo) => void;
  clearRoom: () => void;
  setPublicRooms: (rooms: PublicRoomInfo[]) => void;
  setError: (message: string | null) => void;
}

const RESUME_KEY = "crewfall-resume";

export function loadResume(): ResumeInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as ResumeInfo) : null;
  } catch {
    return null;
  }
}

function saveResume(info: ResumeInfo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (info) window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(info));
    else window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // storage unavailable (private mode) — reconnection across refresh disabled
  }
}

export const useLobbyStore = create<LobbyStoreState>((set) => ({
  status: "idle",
  lobby: null,
  myPlayerId: null,
  resume: null,
  publicRooms: [],
  lastError: null,
  setStatus: (status) => set({ status }),
  setLobby: (lobby) => set({ lobby }),
  setJoined: (info) => {
    saveResume(info);
    set({ myPlayerId: info.playerId, resume: info, lastError: null });
  },
  clearRoom: () => {
    saveResume(null);
    set({ lobby: null, myPlayerId: null, resume: null });
  },
  setPublicRooms: (publicRooms) => set({ publicRooms }),
  setError: (lastError) => set({ lastError }),
}));

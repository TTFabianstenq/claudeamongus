"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HatId, PlayerColorId } from "@/shared/constants";

interface SessionState {
  name: string;
  color: PlayerColorId;
  hat: HatId;
  theme: "dark" | "light";
  sfxVolume: number;
  reducedMotion: boolean;
  setName: (name: string) => void;
  setColor: (color: PlayerColorId) => void;
  setHat: (hat: HatId) => void;
  setTheme: (theme: "dark" | "light") => void;
  setSfxVolume: (v: number) => void;
  setReducedMotion: (v: boolean) => void;
}

/** Local player preferences, persisted to localStorage. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      name: "",
      color: "red",
      hat: "none",
      theme: "dark",
      sfxVolume: 0.8,
      reducedMotion: false,
      setName: (name) => set({ name }),
      setColor: (color) => set({ color }),
      setHat: (hat) => set({ hat }),
      setTheme: (theme) => set({ theme }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    { name: "crewfall-session" },
  ),
);

/**
 * Fast-changing HUD state, kept separate from the main game store so the
 * per-frame gameplay loop can update it (throttled) without re-rendering
 * menu-level React trees.
 */

import { create } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  kind: 'item' | 'info' | 'objective';
}

interface HudState {
  prompt: string | null;
  /** 0..1 vitals mirrored at ~10 Hz from the player controller. */
  health: number;
  stamina: number;
  battery: number;
  /** Enemy proximity dread 0..1 (drives vignette + heartbeat UI). */
  dread: number;
  hidden: boolean;
  holdingBreath: boolean;
  damageFlash: number; // bumps on hit, decays in UI
  toasts: Toast[];
  hint: string | null;
  interactPulse: number;
  setPrompt: (p: string | null) => void;
  setVitals: (v: { health: number; stamina: number; battery: number; dread: number }) => void;
  setHidden: (hidden: boolean, holdingBreath: boolean) => void;
  flashDamage: () => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  expireToast: (id: number) => void;
  setHint: (hint: string | null) => void;
}

let toastId = 1;

export const useHud = create<HudState>((set) => ({
  prompt: null,
  health: 1,
  stamina: 1,
  battery: 1,
  dread: 0,
  hidden: false,
  holdingBreath: false,
  damageFlash: 0,
  toasts: [],
  hint: null,
  interactPulse: 0,
  setPrompt: (prompt) => set((s) => (s.prompt === prompt ? s : { prompt })),
  setVitals: (v) => set(v),
  setHidden: (hidden, holdingBreath) =>
    set((s) =>
      s.hidden === hidden && s.holdingBreath === holdingBreath ? s : { hidden, holdingBreath }
    ),
  flashDamage: () => set((s) => ({ damageFlash: s.damageFlash + 1 })),
  toast: (text, kind = 'info') =>
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id: toastId++, text, kind }] })),
  expireToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setHint: (hint) => set({ hint }),
}));

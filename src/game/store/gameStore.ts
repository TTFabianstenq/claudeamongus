"use client";

import { create } from "zustand";
import type { HatId, PlayerColorId } from "@/shared/constants";
import type {
  ActiveSabotage,
  ChatMessage,
  GameOverPayload,
  GameSnapshot,
  MeetingState,
  Role,
  RoomSettings,
  TaskAssignment,
  TaskKind,
} from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";

export interface PlayerMeta {
  id: string;
  name: string;
  color: PlayerColorId;
  hat: HatId;
}

/** What the local player can interact with right now (HUD button states). */
export interface ActionContext {
  useTarget:
    | { type: "task"; taskId: string; label: string }
    | { type: "fix"; kind: "lights" | "reactor" | "o2" | "comms"; panelId: string; label: string }
    | { type: "emergency" }
    | { type: "admin" }
    | { type: "cameras" }
    | null;
  ventId: string | null;
  killTargetId: string | null;
  reportBodyId: string | null;
}

export type OpenPanel =
  | { type: "task"; taskId: string; kind: TaskKind }
  | { type: "fix"; kind: "lights" | "reactor" | "o2" | "comms"; panelId: string }
  | { type: "admin" }
  | { type: "cameras" }
  | { type: "sabotage" }
  | null;

interface GameStoreState {
  inGame: boolean;
  role: Role;
  mates: string[];
  tasks: TaskAssignment[];
  fakeTasksNote: boolean;
  settings: RoomSettings;
  playersMeta: Record<string, PlayerMeta>;
  taskBar: number;
  sabotage: ActiveSabotage | null;
  killCooldownAt: number;
  emergenciesLeft: number;
  meeting: MeetingState | null;
  gameOver: GameOverPayload | null;
  amDead: boolean;
  inVentId: string | null;
  killCam: { killerId: string; victimId: string } | null;
  context: ActionContext;
  openPanel: OpenPanel;
  chat: ChatMessage[];
  admin: GameSnapshot["admin"];
  cameras: GameSnapshot["cameras"];
  visualToast: { kind: TaskKind; playerName: string } | null;

  startGame: (payload: {
    role: Role;
    mates: string[];
    tasks: TaskAssignment[];
    settings: RoomSettings;
    playersMeta: Record<string, PlayerMeta>;
  }) => void;
  reset: () => void;
  setTasks: (tasks: TaskAssignment[]) => void;
  setSnapshotState: (
    s: Pick<GameSnapshot, "taskBar" | "sabotage" | "killCooldownAt" | "emergenciesLeft" | "admin" | "cameras">,
  ) => void;
  setMeeting: (meeting: MeetingState | null) => void;
  setGameOver: (payload: GameOverPayload | null) => void;
  setAmDead: (dead: boolean) => void;
  setInVent: (ventId: string | null) => void;
  setKillCam: (cam: { killerId: string; victimId: string } | null) => void;
  setContext: (context: ActionContext) => void;
  setOpenPanel: (panel: OpenPanel) => void;
  addChat: (message: ChatMessage) => void;
  clearChat: () => void;
  setVisualToast: (toast: { kind: TaskKind; playerName: string } | null) => void;
}

const EMPTY_CONTEXT: ActionContext = {
  useTarget: null,
  ventId: null,
  killTargetId: null,
  reportBodyId: null,
};

export const useGameStore = create<GameStoreState>((set) => ({
  inGame: false,
  role: "crewmate",
  mates: [],
  tasks: [],
  fakeTasksNote: false,
  settings: DEFAULT_SETTINGS,
  playersMeta: {},
  taskBar: 0,
  sabotage: null,
  killCooldownAt: 0,
  emergenciesLeft: 1,
  meeting: null,
  gameOver: null,
  amDead: false,
  inVentId: null,
  killCam: null,
  context: EMPTY_CONTEXT,
  openPanel: null,
  chat: [],
  admin: null,
  cameras: null,
  visualToast: null,

  startGame: (payload) =>
    set({
      inGame: true,
      role: payload.role,
      mates: payload.mates,
      tasks: payload.tasks,
      fakeTasksNote: payload.role === "impostor",
      settings: payload.settings,
      playersMeta: payload.playersMeta,
      taskBar: 0,
      sabotage: null,
      meeting: null,
      gameOver: null,
      amDead: false,
      inVentId: null,
      killCam: null,
      context: EMPTY_CONTEXT,
      openPanel: null,
      admin: null,
      cameras: null,
      visualToast: null,
    }),
  reset: () =>
    set({
      inGame: false,
      role: "crewmate",
      mates: [],
      tasks: [],
      fakeTasksNote: false,
      taskBar: 0,
      sabotage: null,
      meeting: null,
      gameOver: null,
      amDead: false,
      inVentId: null,
      killCam: null,
      context: EMPTY_CONTEXT,
      openPanel: null,
      chat: [],
      admin: null,
      cameras: null,
      visualToast: null,
    }),
  setTasks: (tasks) => set({ tasks }),
  setSnapshotState: (s) =>
    set({
      taskBar: s.taskBar,
      sabotage: s.sabotage,
      killCooldownAt: s.killCooldownAt,
      emergenciesLeft: s.emergenciesLeft,
      admin: s.admin,
      cameras: s.cameras,
    }),
  setMeeting: (meeting) => set({ meeting }),
  setGameOver: (gameOver) => set({ gameOver }),
  setAmDead: (amDead) => set({ amDead }),
  setInVent: (inVentId) => set({ inVentId }),
  setKillCam: (killCam) => set({ killCam }),
  setContext: (context) => set({ context }),
  setOpenPanel: (openPanel) => set({ openPanel }),
  addChat: (message) =>
    set((state) => ({ chat: [...state.chat.slice(-99), message] })),
  clearChat: () => set({ chat: [] }),
  setVisualToast: (visualToast) => set({ visualToast }),
}));

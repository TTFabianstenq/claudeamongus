"use client";

import { GameCanvas } from "@/components/game/GameCanvas";
import { GameHud } from "@/components/game/GameHud";
import { MobileControls } from "@/components/game/MobileControls";
import { MeetingOverlay } from "@/components/game/MeetingOverlay";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import { KillOverlay } from "@/components/game/KillOverlay";
import { TaskModal } from "@/components/game/TaskModal";
import { SabotagePanel } from "@/components/game/SabotagePanel";
import { AdminPanel } from "@/components/game/AdminPanel";
import { CamerasPanel } from "@/components/game/CamerasPanel";
import { VentOverlay } from "@/components/game/VentOverlay";
import { VisualTaskToast } from "@/components/game/VisualTaskToast";

/** Layers, bottom to top: canvas -> HUD -> modals -> meeting -> kill cam -> game over. */
export function GameView() {
  return (
    <div className="relative h-full w-full select-none">
      <GameCanvas />
      <GameHud />
      <MobileControls />
      <VentOverlay />
      <TaskModal />
      <AdminPanel />
      <CamerasPanel />
      <SabotagePanel />
      <VisualTaskToast />
      <MeetingOverlay />
      <KillOverlay />
      <GameOverOverlay />
    </div>
  );
}

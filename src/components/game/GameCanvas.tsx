"use client";

import { useEffect, useRef } from "react";
import { getGameClient } from "@/game/client/GameClient";
import { inputManager } from "@/game/input/InputManager";
import { Renderer } from "@/game/render/Renderer";
import { useGameStore } from "@/game/store/gameStore";

/**
 * Hosts the canvas and the requestAnimationFrame loop. React re-renders
 * never touch the hot path: the loop reads the GameClient and the zustand
 * stores imperatively each frame.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const client = getGameClient();
    if (!canvas || !client) return;

    const renderer = new Renderer(canvas);
    let raf = 0;
    let lastTime = performance.now();

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      renderer.resize(rect.width, rect.height, dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const offAction = inputManager.onAction((action) => {
      const store = useGameStore.getState();
      if (store.gameOver) return;
      switch (action) {
        case "use":
          if (store.meeting) return;
          void client.useAction();
          break;
        case "kill":
          if (store.meeting) return;
          void client.killAction();
          break;
        case "report":
          if (store.meeting) return;
          void client.reportAction();
          break;
        case "vent":
          if (store.meeting) return;
          void client.ventAction();
          break;
        case "sabotage":
          if (store.meeting || store.role !== "impostor") return;
          store.setOpenPanel(store.openPanel?.type === "sabotage" ? null : { type: "sabotage" });
          break;
        case "map":
          if (store.meeting) return;
          store.setOpenPanel(store.openPanel?.type === "sabotage" ? null : { type: "sabotage" });
          break;
        case "close":
          store.setOpenPanel(null);
          break;
        default:
          break;
      }
    });
    inputManager.attach();

    const loop = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      client.update(time);
      const store = useGameStore.getState();
      const target = store.context.useTarget;
      const highlightConsoleId =
        target?.type === "task"
          ? (store.tasks.find((t) => t.id === target.taskId)?.consoleIds[
              store.tasks.find((t) => t.id === target.taskId)?.stage ?? 0
            ] ?? null)
          : target?.type === "fix"
            ? target.panelId
            : null;
      renderer.render(
        client.getRenderState(),
        {
          playersMeta: store.playersMeta,
          myRole: store.role,
          mates: store.mates,
          highlightConsoleId,
          highlightVentId: store.context.ventId,
          meIsDead: store.amDead,
        },
        dt,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      offAction();
      inputManager.detach();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="Game view"
      role="application"
    />
  );
}

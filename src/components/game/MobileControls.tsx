"use client";

import { useEffect, useRef, useState } from "react";
import { inputManager } from "@/game/input/InputManager";

const RADIUS = 56;

/** Touch joystick (left thumb). Only rendered on coarse-pointer devices. */
export function MobileControls() {
  const [isTouch, setIsTouch] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    return () => inputManager.setJoystick(0, 0);
  }, []);

  if (!isTouch) return null;

  const updateFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current?.getBoundingClientRect();
    if (!base) return;
    const cx = base.left + base.width / 2;
    const cy = base.top + base.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy, active: true });
    inputManager.setJoystick(dx / RADIUS, dy / RADIUS);
  };

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0, active: false });
    inputManager.setJoystick(0, 0);
  };

  return (
    <div
      className="absolute bottom-6 left-4 z-20 touch-none select-none sm:left-8"
      aria-label="Movement joystick"
    >
      <div
        ref={baseRef}
        className="border-space-600 relative h-36 w-36 rounded-full border-2 bg-white/5 backdrop-blur-sm"
        onPointerDown={(e) => {
          pointerId.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerId.current === e.pointerId) updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div
          className={`absolute left-1/2 top-1/2 h-16 w-16 rounded-full transition-colors ${
            knob.active ? "bg-accent-500/80" : "bg-white/20"
          }`}
          style={{
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          }}
        />
      </div>
    </div>
  );
}

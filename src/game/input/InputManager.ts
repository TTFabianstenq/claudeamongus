"use client";

/**
 * Unified input abstraction: keyboard (WASD / arrows), an on-screen touch
 * joystick, and any connected gamepad all produce the same normalized move
 * vector and the same named action events. New devices plug in by mapping
 * to `InputAction` — nothing downstream changes.
 */

export type InputAction = "use" | "kill" | "report" | "vent" | "sabotage" | "map" | "close";

const KEY_BINDINGS: Record<string, InputAction> = {
  KeyE: "use",
  Space: "use",
  Enter: "use",
  KeyQ: "kill",
  KeyR: "report",
  KeyV: "vent",
  KeyF: "sabotage",
  KeyM: "map",
  Tab: "map",
  Escape: "close",
};

const GAMEPAD_BINDINGS: Record<number, InputAction> = {
  0: "use", // A
  2: "kill", // X
  3: "report", // Y
  1: "vent", // B
  4: "sabotage", // LB
  9: "map", // start
  8: "close", // back
};

type ActionListener = (action: InputAction) => void;

export class InputManager {
  private keys = new Set<string>();
  private joystick = { x: 0, y: 0 };
  private listeners = new Set<ActionListener>();
  private gamepadPressed = new Set<number>();
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    // never steal keys from text inputs (chat, name fields)
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const action = KEY_BINDINGS[e.code];
    if (action) {
      e.preventDefault();
      if (!e.repeat) this.emit(action);
      return;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  attach(): void {
    if (this.attached || typeof window === "undefined") return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.attached = false;
  }

  onAction(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(action: InputAction): void {
    for (const listener of this.listeners) listener(action);
  }

  /** Set by the on-screen joystick (pointer events). */
  setJoystick(x: number, y: number): void {
    this.joystick.x = x;
    this.joystick.y = y;
  }

  /** Polled each frame; also samples gamepad buttons as edge-triggered actions. */
  getMoveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;

    x += this.joystick.x;
    y += this.joystick.y;

    const pads =
      typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const gx = pad.axes[0] ?? 0;
      const gy = pad.axes[1] ?? 0;
      if (Math.abs(gx) > 0.2) x += gx;
      if (Math.abs(gy) > 0.2) y += gy;
      pad.buttons.forEach((button, index) => {
        const action = GAMEPAD_BINDINGS[index];
        if (!action) return;
        if (button.pressed && !this.gamepadPressed.has(index)) {
          this.gamepadPressed.add(index);
          this.emit(action);
        } else if (!button.pressed) {
          this.gamepadPressed.delete(index);
        }
      });
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}

export const inputManager = new InputManager();

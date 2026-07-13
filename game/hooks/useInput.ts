/**
 * Keyboard + pointer-lock mouse input. A singleton outside React so the
 * per-frame gameplay loop reads it without subscriptions; the hook wires
 * listeners and pointer-lock lifecycle.
 */

import { useEffect } from 'react';
import { useGame } from '@/game/state/gameStore';
import { AudioEngine } from '@/game/audio/engine';

export interface InputState {
  keys: Set<string>;
  /** Accumulated mouse deltas, consumed once per frame. */
  mouseDX: number;
  mouseDY: number;
  /** Edge-triggered actions (set by listeners, cleared by consumers). */
  pressed: Set<string>;
  pointerLocked: boolean;
  wantsLock: boolean;
}

export const Input: InputState = {
  keys: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  pressed: new Set(),
  pointerLocked: false,
  wantsLock: false,
};

export function consumeMouse(): [number, number] {
  const dx = Input.mouseDX;
  const dy = Input.mouseDY;
  Input.mouseDX = 0;
  Input.mouseDY = 0;
  return [dx, dy];
}

export function consumePressed(code: string): boolean {
  if (Input.pressed.has(code)) {
    Input.pressed.delete(code);
    return true;
  }
  return false;
}

export function requestPointerLock(): void {
  Input.wantsLock = true;
  const canvas = document.querySelector('canvas');
  if (canvas && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
}

export function releasePointerLock(): void {
  Input.wantsLock = false;
  if (document.pointerLockElement) document.exitPointerLock?.();
}

/** Mounted once by the game shell. */
export function useInputListeners(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      Input.keys.add(e.code);
      Input.pressed.add(e.code);
      const g = useGame.getState();

      // Global UI keys work regardless of pointer lock.
      if (e.code === 'Escape') return; // browser handles lock exit; overlay logic below
      if (g.phase === 'playing') {
        if (e.code === 'Tab') {
          e.preventDefault();
          if (g.overlay === null) {
            g.setOverlay('inventory');
            releasePointerLock();
          } else if (g.overlay === 'inventory') {
            g.setOverlay(null);
            requestPointerLock();
          }
        }
      }
      // Never let game keys scroll the page.
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      Input.keys.delete(e.code);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!Input.pointerLocked) return;
      Input.mouseDX += e.movementX;
      Input.mouseDY += e.movementY;
    };
    const onMouseDown = (e: MouseEvent) => {
      AudioEngine.unlock();
      if (!Input.pointerLocked) return;
      Input.pressed.add(e.button === 0 ? 'Mouse0' : e.button === 2 ? 'Mouse2' : 'Mouse1');
      Input.keys.add(e.button === 0 ? 'Mouse0' : e.button === 2 ? 'Mouse2' : 'Mouse1');
    };
    const onMouseUp = (e: MouseEvent) => {
      Input.keys.delete(e.button === 0 ? 'Mouse0' : e.button === 2 ? 'Mouse2' : 'Mouse1');
    };
    const onContext = (e: Event) => {
      const g = useGame.getState();
      if (g.phase === 'playing') e.preventDefault();
    };
    const onLockChange = () => {
      const locked = document.pointerLockElement !== null;
      Input.pointerLocked = locked;
      const g = useGame.getState();
      if (!locked && g.phase === 'playing' && g.overlay === null && Input.wantsLock) {
        // The browser kicked us out (Esc) → pause.
        Input.wantsLock = false;
        g.setOverlay('pause');
      }
    };
    const onBlur = () => {
      Input.keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContext);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}

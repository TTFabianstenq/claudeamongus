'use client';

/**
 * Top-level game shell: mounts the 3D world for active runs, routes between
 * menu / loading / intro / playing / death / victory, and manages pointer
 * lock around UI overlays.
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import GameCanvas from '@/components/canvas/GameCanvas';
import MainMenu from '@/components/ui/MainMenu';
import LoadingScreen from '@/components/ui/LoadingScreen';
import IntroOverlay from '@/components/ui/IntroOverlay';
import HUD from '@/components/ui/HUD';
import PauseMenu from '@/components/ui/PauseMenu';
import SettingsPanel from '@/components/ui/SettingsPanel';
import InventoryPanel from '@/components/ui/InventoryPanel';
import NoteOverlay from '@/components/ui/NoteOverlay';
import KeypadOverlay from '@/components/ui/KeypadOverlay';
import SafeOverlay from '@/components/ui/SafeOverlay';
import SavesPanel from '@/components/ui/SavesPanel';
import HowToPlay from '@/components/ui/HowToPlay';
import EndScreens from '@/components/ui/EndScreens';
import { useGame } from '@/game/state/gameStore';
import {
  useInputListeners,
  requestPointerLock,
  releasePointerLock,
  Input,
} from '@/game/hooks/useInput';

export default function GameApp() {
  const phase = useGame((s) => s.phase);
  const overlay = useGame((s) => s.overlay);
  const [locked, setLocked] = useState(false);
  useInputListeners();

  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  // Overlays release the pointer; closing them re-locks (via click handlers).
  useEffect(() => {
    if (phase !== 'playing') {
      if (phase === 'dead' || phase === 'victory' || phase === 'menu') releasePointerLock();
      return;
    }
    if (overlay !== null) releasePointerLock();
  }, [phase, overlay]);

  const onWorldClick = useCallback(() => {
    const g = useGame.getState();
    if (g.phase === 'playing' && g.overlay === null && !Input.pointerLocked) {
      requestPointerLock();
    }
  }, []);

  const worldMounted = phase !== 'menu';

  return (
    <div className="app-root" onClick={onWorldClick}>
      {worldMounted && <GameCanvas />}

      {phase === 'playing' && <HUD locked={locked} />}

      <AnimatePresence>
        {phase === 'menu' && <MainMenu key="menu" />}
        {phase === 'loading' && <LoadingScreen key="loading" />}
        {phase === 'intro' && <IntroOverlay key="intro" />}
        {(phase === 'dead' || phase === 'victory') && <EndScreens key="end" />}

        {phase === 'playing' && overlay === 'pause' && <PauseMenu key="pause" />}
        {overlay === 'settings' && <SettingsPanel key="settings" />}
        {phase === 'playing' && overlay === 'inventory' && <InventoryPanel key="inventory" />}
        {overlay === 'note' && <NoteOverlay key="note" />}
        {overlay === 'keypad' && <KeypadOverlay key="keypad" />}
        {overlay === 'safe' && <SafeOverlay key="safe" />}
        {overlay === 'saves' && <SavesPanel key="saves" />}
        {overlay === 'howto' && <HowToPlay key="howto" />}
      </AnimatePresence>
    </div>
  );
}

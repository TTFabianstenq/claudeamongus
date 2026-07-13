'use client';

/**
 * Per-frame audio glue: positions the Howler listener at the camera, drives
 * the adaptive score (drone ↔ chase), and the proximity heartbeat.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AudioEngine } from '@/game/audio/engine';
import { RT } from '@/game/state/runtime';
import { useGame } from '@/game/state/gameStore';
import { clamp01 } from '@/game/utils/math';

export default function AudioSync() {
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    state.camera.getWorldDirection(dir);
    AudioEngine.update(dt, state.camera.position as THREE.Vector3, dir);

    const g = useGame.getState();
    const inGame = g.phase === 'playing' || g.phase === 'dead';
    const st = RT.enemy.state;
    const mood =
      st === 'chase' || st === 'attack'
        ? 1
        : st === 'track'
          ? 0.8
          : st === 'search' || st === 'investigate'
            ? 0.45
            : 0;
    const dist = RT.enemy.pos.distanceTo(RT.player.pos);
    const heartbeat = RT.enemy.active
      ? clamp01((1 - dist / 12) * 0.9 + (mood === 1 ? 0.35 : 0))
      : 0;
    AudioEngine.updateMusic(dt, { mood, heartbeat, inGame });
  });

  useEffect(() => {
    return () => {
      AudioEngine.stopAllLoops();
    };
  }, []);

  return null;
}

'use client';

/**
 * The 3D world root: canvas, physics, and every world system. Mounted when
 * a run starts and remounted (fresh world) per run via worldEpoch.
 */

import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { useGame } from '@/game/state/gameStore';
import { useSettings, qualityConfig } from '@/game/state/settingsStore';
import { emitNoise, RT } from '@/game/state/runtime';
import House from '@/components/canvas/House';
import Doors from '@/components/canvas/Doors';
import Furniture from '@/components/canvas/Furniture';
import Windows from '@/components/canvas/Windows';
import Lights from '@/components/canvas/Lights';
import Items from '@/components/canvas/Items';
import Props from '@/components/canvas/Props';
import Exterior from '@/components/canvas/Exterior';
import SkyWeather from '@/components/canvas/SkyWeather';
import Particles from '@/components/canvas/Particles';
import Player from '@/components/canvas/Player';
import Enemy from '@/components/canvas/Enemy';
import PostFX from '@/components/canvas/PostFX';
import AudioSync from '@/components/canvas/AudioSync';
import GameDirector from '@/components/canvas/GameDirector';
import DebugPanel from '@/components/canvas/DebugPanel';

export default function GameCanvas() {
  const worldEpoch = useGame((s) => s.worldEpoch);
  const phase = useGame((s) => s.phase);
  const overlay = useGame((s) => s.overlay);
  const fov = useSettings((s) => s.fov);
  const quality = qualityConfig();
  const paused = phase === 'playing' ? overlay !== null : phase !== 'intro';
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    const on = window.location.search.includes('debug');
    setDebug(on);
    if (on) {
      // QA hook: lets automated tests observe the simulation.
      (window as unknown as Record<string, unknown>).__hm = {
        RT,
        useGame,
        emitNoise,
      };
    }
  }, []);

  return (
    <div className="game-canvas">
      <Canvas
        key={worldEpoch}
        shadows={quality.shadows}
        dpr={[0.75, quality.dprMax]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ fov, near: 0.08, far: 260, position: [-1.5, 1.6, 6.6] }}
        onCreated={({ gl }) => {
          // Postprocessing owns tone mapping (ACES in the chain).
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Physics timeStep="vary" paused={paused} colliders={false}>
            <House />
            <Doors />
            <Furniture />
            <Windows />
            <Exterior />
            <Props />
            <Player />
            <Enemy />
          </Physics>
          <Lights />
          <Items />
          <SkyWeather />
          <Particles />
          <AudioSync />
          <GameDirector />
          <PostFX />
          {debug && <DebugPanel />}
        </Suspense>
      </Canvas>
    </div>
  );
}

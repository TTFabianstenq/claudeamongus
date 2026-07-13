'use client';

/**
 * Interior lighting: every room has a fixture (shade + emissive bulb), but
 * only the handful nearest the camera carry a real PointLight — the rest
 * glow emissively. Mains fixtures need power restored and their wall switch
 * on; basement bulbs hang on the old always-live circuit and flicker.
 * The Keeper's presence makes nearby lights stutter — an audible-visible
 * early warning that something is close.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LIGHTS, ROOM_BY_ID, SWITCHES } from '@/game/levels/layout';
import { FLOOR_Y, LightFixtureDef, WALL_H } from '@/game/types';
import { useGame } from '@/game/state/gameStore';
import { emitNoise, registerInteractable, RT } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import { qualityConfig } from '@/game/state/settingsStore';
import { makeBulbMaterial } from '@/game/graphics/materials';
import { MAT } from '@/game/graphics/materials';

interface FixtureRuntime {
  def: LightFixtureDef;
  pos: THREE.Vector3;
  bulbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight | null;
  flickerPhase: number;
}

function fixtureY(def: LightFixtureDef): number {
  return FLOOR_Y[def.floor] + (WALL_H[def.floor] ?? 2.7) - 0.35;
}

export default function Lights() {
  const quality = qualityConfig();
  const groupRef = useRef<THREE.Group>(null);

  const fixtures = useMemo<FixtureRuntime[]>(
    () =>
      LIGHTS.map((def) => ({
        def,
        pos: new THREE.Vector3(def.pos[0], fixtureY(def), def.pos[1]),
        bulbMat: makeBulbMaterial(def.color ?? '#ffd9a0'),
        light: null,
        flickerPhase: Math.random() * 100,
      })),
    []
  );

  // Pool of real point lights, reassigned to the nearest lit fixtures.
  const pool = useMemo(
    () =>
      Array.from({ length: quality.maxLights }, () => {
        const l = new THREE.PointLight('#ffd9a0', 0, 11, 1.8);
        l.visible = false;
        return l;
      }),
    [quality.maxLights]
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    for (const l of pool) group.add(l);
    return () => {
      for (const l of pool) group.remove(l);
    };
  }, [pool]);

  // Wall switches.
  useEffect(() => {
    const unsubs = SWITCHES.map((sw) =>
      registerInteractable({
        id: sw.id,
        pos: new THREE.Vector3(sw.pos[0], FLOOR_Y[sw.floor] + sw.pos[1], sw.pos[2]),
        radius: 1.4,
        prompt: () => {
          const g = useGame.getState();
          const room = ROOM_BY_ID[sw.room];
          if (!g.flags.powerOn) return `Light switch (dead) — ${room.name}`;
          return g.litRooms[sw.room] ? 'Lights off' : 'Lights on';
        },
        action: () => {
          const g = useGame.getState();
          const p = [sw.pos[0], FLOOR_Y[sw.floor] + sw.pos[1], sw.pos[2]] as [
            number,
            number,
            number,
          ];
          AudioEngine.play3d('switch_click', p, { volume: 0.9 });
          emitNoise(p[0], p[1], p[2], 0.14, 'door');
          if (!g.flags.powerOn) return;
          g.toggleRoomLight(sw.room);
        },
      })
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  useFrame((state) => {
    const g = useGame.getState();
    const t = state.clock.elapsedTime;
    const camPos = state.camera.position;

    // Determine per-fixture on/brightness.
    const lit: { f: FixtureRuntime; brightness: number; d2: number }[] = [];
    for (const f of fixtures) {
      const { def } = f;
      let on = false;
      if (def.offGrid) on = true;
      else if (g.flags.powerOn && g.litRooms[def.room]) on = true;
      let brightness = 0;
      if (on) {
        brightness = def.intensity ?? 1;
        const flicker = def.flicker ?? 0;
        if (flicker > 0) {
          const n = Math.sin(t * 13 + f.flickerPhase) * Math.sin(t * 7.3 + f.flickerPhase * 2.7);
          if (n > 1 - flicker * 0.9) brightness *= 0.15 + Math.random() * 0.3;
        }
        // The Keeper disturbs electricity within ~7 m.
        if (RT.enemy.active) {
          const dK = RT.enemy.pos.distanceTo(f.pos);
          if (dK < 7 && Math.random() < 0.22) brightness *= Math.random() * 0.55;
        }
        // Lightning surges leak in everywhere.
        brightness *= 1 + RT.weather.lightning * 0.25;
      }
      f.bulbMat.emissiveIntensity = brightness * 3.4;
      if (brightness > 0.02) {
        lit.push({ f, brightness, d2: f.pos.distanceToSquared(camPos as THREE.Vector3) });
      }
    }

    // Assign pooled point lights to the nearest lit fixtures.
    lit.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < pool.length; i++) {
      const light = pool[i];
      const entry = lit[i];
      if (entry && entry.d2 < 30 * 30) {
        light.visible = true;
        light.position.copy(entry.f.pos).y -= 0.15;
        light.color.set(entry.f.def.color ?? '#ffd9a0');
        light.intensity = entry.brightness * 6.5;
      } else {
        light.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {fixtures.map((f) => (
        <group key={f.def.id} position={f.pos}>
          {/* cord + shade + bulb */}
          <mesh position={[0, 0.25, 0]} material={MAT.metalDark()}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 5]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} material={MAT.metalDark()}>
            <coneGeometry args={[0.16, 0.14, 10, 1, true]} />
          </mesh>
          <mesh material={f.bulbMat}>
            <sphereGeometry args={[0.055, 8, 6]} />
          </mesh>
        </group>
      ))}
      {/* switch plates */}
      {SWITCHES.map((sw) => (
        <mesh
          key={sw.id}
          position={[sw.pos[0], FLOOR_Y[sw.floor] + sw.pos[1], sw.pos[2]]}
          material={MAT.porcelain()}
        >
          <boxGeometry args={[0.09, 0.13, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

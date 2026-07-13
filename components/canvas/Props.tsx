'use client';

/**
 * Dynamic physics props — cans, bottles, boxes, a loose brick — that can be
 * grabbed, carried, stacked and thrown. Impacts ring out as real noise
 * events, so a hurled bottle down the hall is a legitimate diversion.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RapierRigidBody, RigidBody } from '@react-three/rapier';
import { RNG } from '@/game/utils/rng';
import { useGame } from '@/game/state/gameStore';
import { emitNoise } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import { MAT } from '@/game/graphics/materials';
import { FLOOR_Y, Vec3 } from '@/game/types';

type PropKind = 'can' | 'bottle' | 'box' | 'brick' | 'bucket';

interface PropSpawn {
  id: string;
  kind: PropKind;
  pos: Vec3;
}

const PROP_SPOTS: { kind: PropKind; pos: Vec3 }[] = [
  { kind: 'can', pos: [-2.2, FLOOR_Y.ground + 0.9, -3.35] }, // kitchen counter
  { kind: 'bottle', pos: [-1.2, FLOOR_Y.ground + 0.9, -3.4] },
  { kind: 'bottle', pos: [-7.2, FLOOR_Y.ground + 0.85, -0.4] }, // dining table
  { kind: 'box', pos: [5.6, FLOOR_Y.ground + 0.95, -1.35] }, // garage bench
  { kind: 'brick', pos: [9.2, FLOOR_Y.ground + 0.15, 6.4] }, // garage floor
  { kind: 'bucket', pos: [4.9, FLOOR_Y.ground + 0.1, -4.0] }, // laundry
  { kind: 'can', pos: [-0.4, FLOOR_Y.basement + 0.85, 5.4] }, // boiler bench
  { kind: 'box', pos: [-2.6, FLOOR_Y.basement + 0.95, -5.4] }, // cellar shelf
  { kind: 'bottle', pos: [-6.3, FLOOR_Y.ground + 0.5, -5.1] }, // library desk
  { kind: 'can', pos: [-9.4, FLOOR_Y.upper + 0.95, 2.9] }, // master dresser
  { kind: 'box', pos: [-6.7, FLOOR_Y.attic + 1.0, -4.5] }, // attic
  { kind: 'brick', pos: [-22.3, 0.6, -20.1] }, // woodshed
  { kind: 'bottle', pos: [1.0, FLOOR_Y.upper + 0.55, 7.3] }, // lounge chest
  { kind: 'can', pos: [7.6, 3.2, 6.1] }, // garage roof stash
];

function PropBody({ spawn }: { spawn: PropSpawn }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const lastSound = useRef(0);

  const { geometry, material, colliderArgs, mass } = useMemo(() => {
    switch (spawn.kind) {
      case 'can':
        return {
          geometry: new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10),
          material: MAT.metal(),
          colliderArgs: 'hull' as const,
          mass: 0.4,
        };
      case 'bottle':
        return {
          geometry: new THREE.CylinderGeometry(0.04, 0.05, 0.26, 10),
          material: MAT.glass(),
          colliderArgs: 'hull' as const,
          mass: 0.6,
        };
      case 'box':
        return {
          geometry: new THREE.BoxGeometry(0.34, 0.26, 0.28),
          material: MAT.midWood(),
          colliderArgs: 'cuboid' as const,
          mass: 1.5,
        };
      case 'brick':
        return {
          geometry: new THREE.BoxGeometry(0.22, 0.1, 0.11),
          material: MAT.stone(),
          colliderArgs: 'cuboid' as const,
          mass: 2.2,
        };
      case 'bucket':
        return {
          geometry: new THREE.CylinderGeometry(0.14, 0.11, 0.26, 12),
          material: MAT.metalDark(),
          colliderArgs: 'hull' as const,
          mass: 1.0,
        };
    }
  }, [spawn.kind]);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={colliderArgs}
      position={spawn.pos}
      mass={mass}
      linearDamping={0.2}
      angularDamping={0.6}
      userData={{ kind: 'prop', propId: spawn.id }}
      onCollisionEnter={() => {
        const body = bodyRef.current;
        if (!body) return;
        const v = body.linvel();
        const speed = Math.hypot(v.x, v.y, v.z);
        const now = performance.now();
        if (speed < 1.2 || now - lastSound.current < 140) return;
        lastSound.current = now;
        const p = body.translation();
        const hard = spawn.kind === 'brick' || spawn.kind === 'bucket' || spawn.kind === 'can';
        const loud = Math.min(1, speed / 8);
        AudioEngine.play3d(hard ? 'impact_hard' : 'impact_soft', [p.x, p.y, p.z], {
          volume: 0.3 + loud * 0.7,
          rate: 0.9 + Math.random() * 0.25,
        });
        if (useGame.getState().phase === 'playing') {
          emitNoise(p.x, p.y, p.z, 0.25 + loud * 0.75, 'impact');
        }
      }}
    >
      <mesh geometry={geometry} material={material} castShadow />
    </RigidBody>
  );
}

export default function Props() {
  const worldEpoch = useGame((s) => s.worldEpoch);
  const spawns = useMemo<PropSpawn[]>(() => {
    const rng = new RNG(useGame.getState().seed ^ 0x9b0b5).fork('props');
    return PROP_SPOTS.map((s, i) => ({
      id: `prop_${i}`,
      kind: s.kind,
      pos: [s.pos[0] + rng.range(-0.08, 0.08), s.pos[1], s.pos[2] + rng.range(-0.08, 0.08)] as Vec3,
    }));
  }, [worldEpoch]);

  return (
    <group>
      {spawns.map((s) => (
        <PropBody key={s.id} spawn={s} />
      ))}
    </group>
  );
}

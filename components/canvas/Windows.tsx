'use client';

/**
 * Windows: frame + cross bars + a glass pane that shatters when a thrown
 * prop hits it hard enough. Breaking glass is one of the loudest sounds in
 * the game — a deliberate distraction tool, and a mistake.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { WINDOWS } from '@/game/levels/layout';
import { FLOOR_Y, WindowDef } from '@/game/types';
import { useGame } from '@/game/state/gameStore';
import { emitNoise } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import { MAT } from '@/game/graphics/materials';

const SILL = 0.95;
const TOP = 2.2;

function Shards({ pos, rotY }: { pos: THREE.Vector3; rotY: number }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: 9 }, () => ({
        x: (Math.random() - 0.5) * 0.9,
        y: Math.random() * 0.9,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -1 - Math.random() * 2,
        r: Math.random() * Math.PI,
        s: 0.05 + Math.random() * 0.08,
      })),
    []
  );
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (ref.current) {
      ref.current.children.forEach((c, i) => {
        const s = seeds[i];
        c.position.x = s.x + s.vx * t.current;
        c.position.y = Math.max(0.03, s.y + s.vy * t.current + -3 * t.current * t.current);
        c.rotation.z = s.r + t.current * 4;
      });
      ref.current.visible = t.current < 4;
    }
  });
  return (
    <group ref={ref} position={pos} rotation={[0, rotY, 0]}>
      {seeds.map((s, i) => (
        <mesh key={i} material={MAT.glass()}>
          <planeGeometry args={[s.s, s.s * 1.4]} />
        </mesh>
      ))}
    </group>
  );
}

function WindowEntity({ def }: { def: WindowDef }) {
  const broken = useGame((s) => s.brokenWindows.includes(def.id));
  const [shatterAt, setShatterAt] = useState<THREE.Vector3 | null>(null);
  const baseY = FLOOR_Y[def.floor];
  const w = def.width ?? 1.3;
  const h = TOP - SILL;
  const cy = baseY + SILL + h / 2;
  const breakable = def.floor === 'ground' && !def.boarded;

  const frame = useMemo(() => {
    const bars: { p: [number, number, number]; s: [number, number, number] }[] = [
      { p: [0, h / 2 + 0.02, 0], s: [w + 0.1, 0.07, 0.1] },
      { p: [0, -h / 2 - 0.02, 0], s: [w + 0.1, 0.07, 0.1] },
      { p: [-w / 2 - 0.02, 0, 0], s: [0.07, h + 0.1, 0.1] },
      { p: [w / 2 + 0.02, 0, 0], s: [0.07, h + 0.1, 0.1] },
      { p: [0, 0, 0], s: [0.045, h, 0.05] },
      { p: [0, 0, 0], s: [w, 0.045, 0.05] },
    ];
    return bars;
  }, [w, h]);

  const boards = useMemo(() => {
    if (!def.boarded) return [];
    return [
      { y: 0.3, r: 0.12 },
      { y: -0.05, r: -0.08 },
      { y: -0.4, r: 0.05 },
    ];
  }, [def.boarded]);

  return (
    <group position={[def.pos[0], cy, def.pos[1]]} rotation={[0, def.rotY, 0]}>
      {frame.map((b, i) => (
        <mesh key={i} position={b.p} castShadow material={MAT.trim()}>
          <boxGeometry args={b.s} />
        </mesh>
      ))}
      {boards.map((b, i) => (
        <mesh
          key={`b${i}`}
          position={[0, b.y, 0.09]}
          rotation={[0, 0, b.r]}
          material={MAT.midWood()}
        >
          <boxGeometry args={[w + 0.24, 0.16, 0.03]} />
        </mesh>
      ))}
      {!broken && (
        <mesh material={MAT.glass()} renderOrder={20}>
          <planeGeometry args={[w - 0.02, h - 0.02]} />
        </mesh>
      )}
      {/* Glass collider: blocks movement; tagged so AI vision passes through. */}
      <RigidBody
        type="fixed"
        colliders={false}
        userData={{ kind: 'glass', windowId: def.id }}
        onCollisionEnter={(e) => {
          if (!breakable || broken) return;
          const other = e.other.rigidBody;
          if (!other) return;
          const ud = other.userData as { kind?: string } | undefined;
          if (ud?.kind !== 'prop') return;
          const v = other.linvel();
          const speed = Math.hypot(v.x, v.y, v.z);
          if (speed < 3.2) return;
          const g = useGame.getState();
          g.breakWindow(def.id);
          const at = new THREE.Vector3(def.pos[0], cy, def.pos[1]);
          setShatterAt(at);
          AudioEngine.play3d('glass_break', at, { volume: 1 });
          emitNoise(at.x, at.y, at.z, 1.25, 'glass');
        }}
      >
        <CuboidCollider args={[w / 2, h / 2, 0.03]} />
      </RigidBody>
      {shatterAt && <Shards pos={new THREE.Vector3(0, -h / 2, 0)} rotY={0} />}
      {broken && (
        // jagged remains along the frame
        <group>
          {[-w / 3, 0.1, w / 3].map((x, i) => (
            <mesh
              key={i}
              position={[x, -h / 2 + 0.09, 0]}
              rotation={[0, 0, 0.35 * (i - 1)]}
              material={MAT.glass()}
            >
              <planeGeometry args={[0.1, 0.16]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export default function Windows() {
  return (
    <group>
      {WINDOWS.map((w) => (
        <WindowEntity key={w.id} def={w} />
      ))}
    </group>
  );
}

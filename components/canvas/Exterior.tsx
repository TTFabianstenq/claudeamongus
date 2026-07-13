'use client';

/**
 * The grounds: lawn, driveway, iron fence with the chained front gate
 * (an escape route), instanced storm-blown forest, shader grass, the
 * woodshed, ground mist and the porch light.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Instance, Instances } from '@react-three/drei';
import { EXTERIOR } from '@/game/levels/layout';
import { useGame } from '@/game/state/gameStore';
import { emitNoise, registerInteractable, RT } from '@/game/state/runtime';
import { useHud } from '@/game/state/hudStore';
import { AudioEngine } from '@/game/audio/engine';
import { RNG } from '@/game/utils/rng';
import { damp } from '@/game/utils/math';
import { floorMaterial, MAT } from '@/game/graphics/materials';
import {
  injectWindSway,
  makeGrassGeometry,
  makeGrassMaterial,
  makeMistMaterial,
} from '@/game/graphics/shaders';
import { qualityConfig } from '@/game/state/settingsStore';

/* ---------------- fence ---------------- */

function Fence() {
  const f = EXTERIOR.fence;
  const gate = EXTERIOR.gate;

  const { posts, rails, bars } = useMemo(() => {
    const posts: [number, number][] = [];
    const rails: { x: number; z: number; len: number; rotY: number }[] = [];
    const bars: { x: number; z: number; rotY: number; count: number; len: number }[] = [];
    const sides: { a: [number, number]; b: [number, number] }[] = [
      { a: [f.x0, f.z0], b: [f.x1, f.z0] },
      { a: [f.x0, f.z1], b: [gate.x0, f.z1] },
      { a: [gate.x1, f.z1], b: [f.x1, f.z1] },
      { a: [f.x0, f.z0], b: [f.x0, f.z1] },
      { a: [f.x1, f.z0], b: [f.x1, f.z1] },
    ];
    for (const { a, b } of sides) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const rotY = Math.atan2(-dz, dx);
      const n = Math.ceil(len / 4);
      for (let i = 0; i <= n; i++) {
        posts.push([a[0] + (dx * i) / n, a[1] + (dz * i) / n]);
      }
      rails.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, len, rotY });
      bars.push({
        x: (a[0] + b[0]) / 2,
        z: (a[1] + b[1]) / 2,
        rotY,
        count: Math.floor(len / 0.55),
        len,
      });
    }
    return { posts, rails, bars };
  }, [f, gate]);

  return (
    <group>
      <Instances range={posts.length} material={MAT.stone()} castShadow>
        <boxGeometry args={[0.34, 2.7, 0.34]} />
        {posts.map(([x, z], i) => (
          <Instance key={i} position={[x, 1.35, z]} />
        ))}
      </Instances>
      {rails.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]} rotation={[0, r.rotY, 0]}>
          <mesh position={[0, 2.3, 0]} material={MAT.metalDark()} castShadow>
            <boxGeometry args={[r.len, 0.07, 0.07]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} material={MAT.metalDark()}>
            <boxGeometry args={[r.len, 0.07, 0.07]} />
          </mesh>
        </group>
      ))}
      {bars.map((b, i) => (
        <Instances key={`bars${i}`} range={b.count} material={MAT.metalDark()}>
          <cylinderGeometry args={[0.022, 0.022, 2.4, 5]} />
          {Array.from({ length: b.count }, (_, j) => {
            const t = (j + 0.5) / b.count - 0.5;
            const lx = t * b.len;
            const x = b.x + Math.cos(b.rotY) * lx;
            const z = b.z - Math.sin(b.rotY) * lx;
            return <Instance key={j} position={[x, 1.4, z]} />;
          })}
        </Instances>
      ))}
      {/* fence colliders (4 walls with a gap at the gate) */}
      <RigidBody type="fixed" colliders={false} userData={{ kind: 'house' }}>
        <CuboidCollider
          args={[(f.x1 - f.x0) / 2, 1.4, 0.2]}
          position={[(f.x0 + f.x1) / 2, 1.4, f.z0]}
        />
        <CuboidCollider
          args={[(gate.x0 - f.x0) / 2, 1.4, 0.2]}
          position={[(f.x0 + gate.x0) / 2, 1.4, f.z1]}
        />
        <CuboidCollider
          args={[(f.x1 - gate.x1) / 2, 1.4, 0.2]}
          position={[(gate.x1 + f.x1) / 2, 1.4, f.z1]}
        />
        <CuboidCollider
          args={[0.2, 1.4, (f.z1 - f.z0) / 2]}
          position={[f.x0, 1.4, (f.z0 + f.z1) / 2]}
        />
        <CuboidCollider
          args={[0.2, 1.4, (f.z1 - f.z0) / 2]}
          position={[f.x1, 1.4, (f.z0 + f.z1) / 2]}
        />
      </RigidBody>
    </group>
  );
}

/* ---------------- front gate ---------------- */

function FrontGate() {
  const gate = EXTERIOR.gate;
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const swing = useRef(0);
  const cx = (gate.x0 + gate.x1) / 2;
  const halfW = (gate.x1 - gate.x0) / 2;
  const escaped = useRef(false);

  useEffect(() => {
    const pos = new THREE.Vector3(cx, 1.2, gate.z);
    return registerInteractable({
      id: 'front_gate',
      pos,
      radius: 2.2,
      priority: 1,
      prompt: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawGate) return 'The main gate';
        if (!fl.gateChainCut) {
          return g.hasItem('bolt_cutters') ? 'Cut the chain' : 'Chained shut';
        }
        if (!fl.gateOpen) return 'Push the gate open';
        return '';
      },
      enabled: () => !useGame.getState().flags.gateOpen,
      action: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawGate) {
          g.setFlag('sawGate');
          useHud
            .getState()
            .toast('A heavy chain and padlock. Bolt cutters would make short work of it.');
          return;
        }
        if (!fl.gateChainCut) {
          if (g.hasItem('bolt_cutters')) {
            g.setFlag('gateChainCut');
            AudioEngine.play3d('chain_cut', pos, { volume: 1 });
            emitNoise(pos.x, pos.y, pos.z, 0.8, 'impact');
            useHud.getState().toast('The chain drops into the mud.');
          } else {
            AudioEngine.play3d('door_locked', pos, { volume: 0.9 });
            emitNoise(pos.x, pos.y, pos.z, 0.3, 'door');
          }
          return;
        }
        g.setFlag('gateOpen');
        AudioEngine.play3d('door_creak', pos, { volume: 1, rate: 0.6 });
        emitNoise(pos.x, pos.y, pos.z, 0.6, 'door');
      },
    });
  }, [cx, gate.z]);

  useFrame((_, dt) => {
    const g = useGame.getState();
    swing.current = damp(swing.current, g.flags.gateOpen ? 1.5 : 0, 1.6, Math.min(dt, 0.05));
    if (leftRef.current) leftRef.current.rotation.y = swing.current;
    if (rightRef.current) rightRef.current.rotation.y = -swing.current;
    // Walking out is the ending.
    if (g.flags.gateOpen && !escaped.current && g.phase === 'playing') {
      if (RT.player.pos.z > gate.z + 1.2 && Math.abs(RT.player.pos.x - cx) < 3.5) {
        escaped.current = true;
        g.win('gate');
      }
    }
  });

  const chainCut = useGame((s) => s.flags.gateChainCut);
  const open = useGame((s) => s.flags.gateOpen);

  const leaf = (side: 1 | -1, ref: React.RefObject<THREE.Group | null>) => (
    <group ref={ref} position={[cx + side * halfW, 0, gate.z]}>
      <mesh position={[-side * halfW * 0.5, 1.3, 0]} material={MAT.metalDark()} castShadow>
        <boxGeometry args={[halfW, 0.08, 0.06]} />
      </mesh>
      <mesh position={[-side * halfW * 0.5, 2.15, 0]} material={MAT.metalDark()} castShadow>
        <boxGeometry args={[halfW, 0.08, 0.06]} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh
          key={i}
          position={[-side * (0.14 + i * 0.28) * halfW, 1.45, 0]}
          material={MAT.metalDark()}
        >
          <cylinderGeometry args={[0.024, 0.024, 2.2, 5]} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group>
      {leaf(1, rightRef)}
      {leaf(-1, leftRef)}
      {!chainCut && (
        <mesh position={[cx, 1.3, gate.z]} rotation={[0, 0, 0.35]} material={MAT.metal()}>
          <torusGeometry args={[0.16, 0.035, 6, 10]} />
        </mesh>
      )}
      {!open && (
        <RigidBody type="fixed" colliders={false} userData={{ kind: 'house' }}>
          <CuboidCollider args={[halfW, 1.3, 0.08]} position={[cx, 1.3, gate.z]} />
        </RigidBody>
      )}
    </group>
  );
}

/* ---------------- woodshed ---------------- */

function Woodshed() {
  const s = EXTERIOR.shed;
  const w = s.x1 - s.x0;
  const d = s.z1 - s.z0;
  const cx = (s.x0 + s.x1) / 2;
  const cz = (s.z0 + s.z1) / 2;
  const H = 2.3;
  return (
    <group>
      {/* walls with a doorway on the south face */}
      <mesh position={[cx, H / 2, s.z0]} material={MAT.midWood()} castShadow receiveShadow>
        <boxGeometry args={[w, H, 0.1]} />
      </mesh>
      <mesh position={[s.x0, H / 2, cz]} material={MAT.midWood()} castShadow receiveShadow>
        <boxGeometry args={[0.1, H, d]} />
      </mesh>
      <mesh position={[s.x1, H / 2, cz]} material={MAT.midWood()} castShadow receiveShadow>
        <boxGeometry args={[0.1, H, d]} />
      </mesh>
      {/* south wall split around the door at doorAt */}
      <mesh
        position={[(s.x0 + (s.doorAt - 0.5)) / 2, H / 2, s.z1]}
        material={MAT.midWood()}
        castShadow
      >
        <boxGeometry args={[s.doorAt - 0.5 - s.x0, H, 0.1]} />
      </mesh>
      <mesh
        position={[(s.doorAt + 0.5 + s.x1) / 2, H / 2, s.z1]}
        material={MAT.midWood()}
        castShadow
      >
        <boxGeometry args={[s.x1 - (s.doorAt + 0.5), H, 0.1]} />
      </mesh>
      <mesh position={[cx, H + 0.12, cz]} rotation={[0, 0, 0.09]} material={MAT.roof()} castShadow>
        <boxGeometry args={[w + 0.5, 0.09, d + 0.5]} />
      </mesh>
      <RigidBody type="fixed" colliders={false} userData={{ kind: 'house' }}>
        <CuboidCollider args={[w / 2, H / 2, 0.06]} position={[cx, H / 2, s.z0]} />
        <CuboidCollider args={[0.06, H / 2, d / 2]} position={[s.x0, H / 2, cz]} />
        <CuboidCollider args={[0.06, H / 2, d / 2]} position={[s.x1, H / 2, cz]} />
        <CuboidCollider
          args={[(s.doorAt - 0.5 - s.x0) / 2, H / 2, 0.06]}
          position={[(s.x0 + (s.doorAt - 0.5)) / 2, H / 2, s.z1]}
        />
        <CuboidCollider
          args={[(s.x1 - (s.doorAt + 0.5)) / 2, H / 2, 0.06]}
          position={[(s.doorAt + 0.5 + s.x1) / 2, H / 2, s.z1]}
        />
      </RigidBody>
    </group>
  );
}

/* ---------------- forest ---------------- */

function Forest() {
  const trees = useMemo(() => {
    const rng = new RNG(0xf0435).fork('forest');
    const list: { x: number; z: number; s: number; r: number }[] = [];
    // Dense ring outside the fence.
    for (let i = 0; i < 170; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(31, 58);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      list.push({ x, z, s: rng.range(0.8, 1.6), r: rng.range(0, Math.PI * 2) });
    }
    // A few brooding trees inside the yard, clear of house and driveway.
    let placed = 0;
    while (placed < 12) {
      const x = rng.range(-26, 26);
      const z = rng.range(-26, 26);
      if (Math.abs(x) < 13 && Math.abs(z) < 12) continue;
      if (x > 3 && z > 6) continue; // driveway
      list.push({ x, z, s: rng.range(0.7, 1.2), r: rng.range(0, Math.PI * 2) });
      placed++;
    }
    return list;
  }, []);

  const trunkMat = MAT.bark();
  const leafMat = useMemo(() => {
    const m = MAT.foliage().clone();
    injectWindSway(m, 1.0);
    return m;
  }, []);

  return (
    <group>
      <Instances range={trees.length} material={trunkMat} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.22, 0.38, 5.4, 7]} />
        {trees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, 2.7 * t.s, t.z]}
            scale={[t.s, t.s, t.s]}
            rotation={[0, t.r, 0]}
          />
        ))}
      </Instances>
      <Instances range={trees.length} material={leafMat} castShadow frustumCulled={false}>
        <coneGeometry args={[2.3, 5.4, 7]} />
        {trees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, (5.4 + 2.2) * t.s, t.z]}
            scale={[t.s, t.s, t.s]}
            rotation={[0, t.r, 0]}
          />
        ))}
      </Instances>
      <Instances range={trees.length} material={leafMat} frustumCulled={false}>
        <coneGeometry args={[1.6, 3.6, 7]} />
        {trees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, (5.4 + 4.6) * t.s, t.z]}
            scale={[t.s, t.s, t.s]}
            rotation={[0, t.r + 1, 0]}
          />
        ))}
      </Instances>
    </group>
  );
}

/* ---------------- grass & mist ---------------- */

function Grass() {
  const quality = qualityConfig();
  const geo = useMemo(() => {
    const rng = new RNG(0x9ea55).fork('grass');
    const offsets = new Float32Array(quality.grassCount * 3);
    let i = 0;
    let guard = 0;
    while (i < quality.grassCount && guard++ < quality.grassCount * 20) {
      const x = rng.range(-27, 27);
      const z = rng.range(-27, 27);
      if (x > -11 && x < 11 && z > -9 && z < 9) continue; // house
      if (x > 5 && x < 9 && z > 8) continue; // driveway
      offsets[i * 3] = x;
      offsets[i * 3 + 1] = 0;
      offsets[i * 3 + 2] = z;
      i++;
    }
    return makeGrassGeometry(offsets.subarray(0, i * 3) as Float32Array);
  }, [quality.grassCount]);
  const mat = useMemo(() => makeGrassMaterial(), []);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uWind.value = RT.weather.wind;
  });

  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

function Mist() {
  const mats = useMemo(() => [makeMistMaterial(), makeMistMaterial(), makeMistMaterial()], []);
  const sheets = useMemo(
    () => [
      { pos: [0, 0.9, -20] as const, rot: 0, scale: [46, 4] as const },
      { pos: [-20, 1.1, 4] as const, rot: Math.PI / 2, scale: [40, 4.5] as const },
      { pos: [16, 0.8, 18] as const, rot: -0.5, scale: [34, 3.5] as const },
    ],
    []
  );
  useFrame((state) => {
    for (const m of mats) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOpacity.value = 0.22 + RT.weather.rain * 0.2;
    }
  });
  if (!qualityConfig().volumetrics) return null;
  return (
    <group>
      {sheets.map((s, i) => (
        <mesh
          key={i}
          position={[s.pos[0], s.pos[1], s.pos[2]]}
          rotation={[0, s.rot, 0]}
          material={mats[i]}
          renderOrder={40}
        >
          <planeGeometry args={[s.scale[0], s.scale[1]]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- porch light ---------------- */

function PorchLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  const bulbMat = useMemo(() => makeBulbLocal(), []);
  function makeBulbLocal() {
    return new THREE.MeshStandardMaterial({
      color: '#332f28',
      emissive: new THREE.Color('#ffb35e'),
      emissiveIntensity: 2,
    });
  }
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Perpetual guttering — the porch light has been dying for years.
    let b = 0.75 + Math.sin(t * 9.3) * Math.sin(t * 5.1) * 0.25;
    if (Math.sin(t * 2.7) > 0.94) b *= 0.2;
    if (lightRef.current) lightRef.current.intensity = b * 7;
    bulbMat.emissiveIntensity = b * 3;
  });
  return (
    <group position={[-0.9, 2.35, 9.9]}>
      <mesh material={MAT.metalDark()}>
        <boxGeometry args={[0.12, 0.26, 0.12]} />
      </mesh>
      <mesh position={[0, -0.06, 0]} material={bulbMat}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      <pointLight ref={lightRef} color="#ffb35e" distance={9} decay={1.8} intensity={6} />
    </group>
  );
}

/* ---------------- ground planes ---------------- */

function Ground() {
  const quality = qualityConfig();
  const dw = EXTERIOR.driveway;
  const wk = EXTERIOR.walkway;
  const grassMat = useMemo(() => {
    const m = floorMaterial('grass').clone();
    (m.map as THREE.Texture).repeat.set(40, 40);
    return m;
  }, []);
  const wetAsphalt = useMemo(() => {
    const m = floorMaterial('asphalt').clone();
    m.roughness = 0.25; // rain-slick
    m.metalness = 0.15;
    (m.map as THREE.Texture).repeat.set(3, 16);
    return m;
  }, []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
        material={grassMat}
      >
        <planeGeometry args={[140, 140]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(dw.x0 + dw.x1) / 2, 0.005, (dw.z0 + dw.z1) / 2]}
        receiveShadow
        material={wetAsphalt}
      >
        <planeGeometry args={[dw.x1 - dw.x0, dw.z1 - dw.z0]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(wk.x0 + wk.x1) / 2, 0.005, (wk.z0 + wk.z1) / 2]}
        receiveShadow
        material={floorMaterial('concrete')}
      >
        <planeGeometry args={[wk.x1 - wk.x0, wk.z1 - wk.z0]} />
      </mesh>
      {/* single ground collider */}
      <RigidBody type="fixed" colliders={false} userData={{ kind: 'house' }}>
        <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.52, 0]} />
      </RigidBody>
      {quality.reflections && (
        // Wet reflective puddle sheet over the driveway.
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(dw.x0 + dw.x1) / 2, 0.012, (dw.z0 + dw.z1) / 2]}
        >
          <planeGeometry args={[dw.x1 - dw.x0, dw.z1 - dw.z0]} />
          <meshStandardMaterial
            color="#0c0e12"
            roughness={0.05}
            metalness={0.9}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}
    </group>
  );
}

export default function Exterior() {
  return (
    <group>
      <Ground />
      <Fence />
      <FrontGate />
      <Woodshed />
      <Forest />
      <Grass />
      <Mist />
      <PorchLight />
    </group>
  );
}

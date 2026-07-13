'use client';

/**
 * All furniture: static shells merged into per-material batches for draw-call
 * economy, plus the interactive layer — searchable containers with animated
 * drawers, hideable wardrobes/beds/pantry, the study safe, both secret
 * passages, the fuse panel, the generator, the estate car (an escape), the
 * cellar hatch (an escape), the attic ladder, vent grates, the radio lure,
 * the piano, and the grandfather clocks.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  ATTIC_HATCH,
  FURNITURE,
  FURN_SPECS,
  HIDE_SPOTS,
  SPAWN_POINTS,
  VENTS,
} from '@/game/levels/layout';
import { FLOOR_Y, FurnDef, ITEMS, Vec3 } from '@/game/types';
import { BoxSpec, mergeBoxes } from '@/game/graphics/geometry';
import { MAT } from '@/game/graphics/materials';
import { emitNoise, registerInteractable, RT } from '@/game/state/runtime';
import { useGame } from '@/game/state/gameStore';
import { useHud } from '@/game/state/hudStore';
import { AudioEngine } from '@/game/audio/engine';
import { damp } from '@/game/utils/math';

type MatKey = 'dark' | 'mid' | 'metal' | 'fabric' | 'porcelain' | 'books' | 'mattress';

interface FurnBuild {
  boxes: { spec: BoxSpec; mat: MatKey }[];
}

const matOf = (key: MatKey): THREE.Material =>
  key === 'dark'
    ? MAT.darkWood()
    : key === 'mid'
      ? MAT.midWood()
      : key === 'metal'
        ? MAT.metal()
        : key === 'fabric'
          ? MAT.fabric()
          : key === 'porcelain'
            ? MAT.porcelain()
            : key === 'books'
              ? MAT.books()
              : MAT.mattress();

/**
 * Static shell boxes per furniture kind, in LOCAL space (origin at floor,
 * front facing -Z). Interactive parts are separate components.
 */
function buildShell(f: FurnDef): FurnBuild {
  const b: { spec: BoxSpec; mat: MatKey }[] = [];
  const add = (
    spec: Partial<BoxSpec> & { w: number; h: number; d: number },
    mat: MatKey = 'dark'
  ) => b.push({ spec: { x: 0, y: 0, z: 0, uvScale: 0.7, ...spec }, mat });

  switch (f.kind) {
    case 'sofa':
      add({ x: 0, y: 0.24, z: 0, w: 2.1, h: 0.48, d: 0.95 }, 'fabric');
      add({ x: 0, y: 0.62, z: 0.36, w: 2.1, h: 0.62, d: 0.24 }, 'fabric');
      add({ x: -0.95, y: 0.55, z: 0, w: 0.2, h: 0.35, d: 0.9 }, 'fabric');
      add({ x: 0.95, y: 0.55, z: 0, w: 0.2, h: 0.35, d: 0.9 }, 'fabric');
      break;
    case 'armchair':
      add({ x: 0, y: 0.22, z: 0, w: 0.95, h: 0.44, d: 0.9 }, 'fabric');
      add({ x: 0, y: 0.6, z: 0.33, w: 0.95, h: 0.62, d: 0.22 }, 'fabric');
      add({ x: -0.42, y: 0.5, z: 0, w: 0.14, h: 0.3, d: 0.85 }, 'fabric');
      add({ x: 0.42, y: 0.5, z: 0, w: 0.14, h: 0.3, d: 0.85 }, 'fabric');
      break;
    case 'coffeetable':
      add({ x: 0, y: 0.42, z: 0, w: 1.2, h: 0.05, d: 0.65 });
      for (const [lx, lz] of [
        [-0.52, -0.25],
        [0.52, -0.25],
        [-0.52, 0.25],
        [0.52, 0.25],
      ]) {
        add({ x: lx, y: 0.2, z: lz, w: 0.06, h: 0.4, d: 0.06 });
      }
      break;
    case 'diningtable':
      add({ x: 0, y: 0.74, z: 0, w: 2.6, h: 0.06, d: 1.2 });
      for (const [lx, lz] of [
        [-1.2, -0.5],
        [1.2, -0.5],
        [-1.2, 0.5],
        [1.2, 0.5],
      ]) {
        add({ x: lx, y: 0.36, z: lz, w: 0.09, h: 0.72, d: 0.09 });
      }
      break;
    case 'chair':
      add({ x: 0, y: 0.45, z: 0, w: 0.45, h: 0.05, d: 0.45 });
      add({ x: 0, y: 0.72, z: 0.2, w: 0.45, h: 0.55, d: 0.05 });
      for (const [lx, lz] of [
        [-0.19, -0.19],
        [0.19, -0.19],
        [-0.19, 0.19],
        [0.19, 0.19],
      ]) {
        add({ x: lx, y: 0.22, z: lz, w: 0.045, h: 0.45, d: 0.045 });
      }
      break;
    case 'sideboard':
    case 'dresser':
      add({
        x: 0,
        y: FURN_SPECS[f.kind].size[2] / 2,
        z: 0,
        w: FURN_SPECS[f.kind].size[0],
        h: FURN_SPECS[f.kind].size[2],
        d: FURN_SPECS[f.kind].size[1],
      });
      break;
    case 'bookshelf': {
      add({ x: 0, y: 1.1, z: 0.14, w: 1.5, h: 2.2, d: 0.14 });
      add({ x: -0.72, y: 1.1, z: 0, w: 0.06, h: 2.2, d: 0.42 });
      add({ x: 0.72, y: 1.1, z: 0, w: 0.06, h: 2.2, d: 0.42 });
      add({ x: 0, y: 2.17, z: 0, w: 1.5, h: 0.06, d: 0.42 });
      add({ x: 0, y: 0.03, z: 0, w: 1.5, h: 0.06, d: 0.42 });
      // book block
      add({ x: 0, y: 1.08, z: -0.02, w: 1.38, h: 2.0, d: 0.3 }, 'books');
      break;
    }
    case 'shelf':
      add({ x: -0.77, y: 0.95, z: 0, w: 0.06, h: 1.9, d: 0.45 }, 'mid');
      add({ x: 0.77, y: 0.95, z: 0, w: 0.06, h: 1.9, d: 0.45 }, 'mid');
      for (const y of [0.3, 0.85, 1.4, 1.86])
        add({ x: 0, y, z: 0, w: 1.6, h: 0.05, d: 0.45 }, 'mid');
      break;
    case 'counter':
      add({ x: 0, y: 0.44, z: 0, w: 1.8, h: 0.82, d: 0.62 });
      add({ x: 0, y: 0.89, z: 0, w: 1.86, h: 0.06, d: 0.66 }, 'mid');
      break;
    case 'stove':
      add({ x: 0, y: 0.45, z: 0, w: 0.75, h: 0.9, d: 0.66 }, 'metal');
      add({ x: 0, y: 0.92, z: 0, w: 0.7, h: 0.04, d: 0.6 }, 'metal');
      break;
    case 'icebox':
      add({ x: 0, y: 0.87, z: 0, w: 0.85, h: 1.75, d: 0.72 }, 'metal');
      add({ x: 0, y: 1.1, z: -0.37, w: 0.2, h: 0.06, d: 0.04 }, 'dark');
      break;
    case 'sink':
      add({ x: 0, y: 0.4, z: 0, w: 0.7, h: 0.8, d: 0.5 }, 'porcelain');
      add({ x: 0, y: 0.83, z: 0.16, w: 0.1, h: 0.22, d: 0.08 }, 'metal');
      break;
    case 'toilet':
      add({ x: 0, y: 0.21, z: 0, w: 0.42, h: 0.42, d: 0.55 }, 'porcelain');
      add({ x: 0, y: 0.55, z: 0.24, w: 0.42, h: 0.55, d: 0.16 }, 'porcelain');
      break;
    case 'bathtub':
      add({ x: 0, y: 0.3, z: 0, w: 1.7, h: 0.6, d: 0.8 }, 'porcelain');
      break;
    case 'cabinet':
      add({ x: 0, y: 0.45, z: 0, w: 0.8, h: 0.9, d: 0.4 });
      break;
    case 'washer':
      add({ x: 0, y: 0.47, z: 0, w: 0.7, h: 0.94, d: 0.68 }, 'metal');
      add({ x: 0, y: 0.55, z: -0.35, w: 0.4, h: 0.4, d: 0.02 }, 'dark');
      break;
    case 'desk':
      add({ x: 0, y: 0.74, z: 0, w: 1.5, h: 0.05, d: 0.78 });
      add({ x: -0.55, y: 0.37, z: 0, w: 0.4, h: 0.74, d: 0.7 });
      add({ x: 0.68, y: 0.37, z: 0.3, w: 0.07, h: 0.74, d: 0.07 });
      add({ x: 0.68, y: 0.37, z: -0.3, w: 0.07, h: 0.74, d: 0.07 });
      break;
    case 'bed':
      add({ x: 0, y: 0.22, z: 0, w: 1.7, h: 0.26, d: 2.1 });
      add({ x: 0, y: 0.45, z: 0, w: 1.64, h: 0.2, d: 2.02 }, 'mattress');
      add({ x: 0, y: 0.62, z: 0.95, w: 1.7, h: 0.7, d: 0.08 });
      add({ x: 0, y: 0.52, z: 0.62, w: 1.5, h: 0.08, d: 0.5 }, 'fabric');
      break;
    case 'singlebed':
      add({ x: 0, y: 0.2, z: 0, w: 1.05, h: 0.22, d: 2.0 });
      add({ x: 0, y: 0.4, z: 0, w: 1.0, h: 0.18, d: 1.94 }, 'mattress');
      add({ x: 0, y: 0.55, z: 0.9, w: 1.05, h: 0.6, d: 0.07 });
      break;
    case 'wardrobe':
      // carcass only — doors are interactive
      add({ x: 0, y: 1.05, z: 0.3, w: 1.25, h: 2.1, d: 0.08 });
      add({ x: -0.6, y: 1.05, z: 0, w: 0.06, h: 2.1, d: 0.68 });
      add({ x: 0.6, y: 1.05, z: 0, w: 0.06, h: 2.1, d: 0.68 });
      add({ x: 0, y: 2.07, z: 0, w: 1.25, h: 0.07, d: 0.68 });
      add({ x: 0, y: 0.035, z: 0, w: 1.25, h: 0.07, d: 0.68 });
      break;
    case 'pantry':
      add({ x: 0, y: 1.02, z: 0.28, w: 1.1, h: 2.05, d: 0.07 });
      add({ x: -0.53, y: 1.02, z: 0, w: 0.05, h: 2.05, d: 0.62 });
      add({ x: 0.53, y: 1.02, z: 0, w: 0.05, h: 2.05, d: 0.62 });
      add({ x: 0, y: 2.02, z: 0, w: 1.1, h: 0.06, d: 0.62 });
      break;
    case 'nightstand':
      add({ x: 0, y: 0.31, z: 0, w: 0.5, h: 0.62, d: 0.45 });
      break;
    case 'toychest':
    case 'trunk':
      add(
        {
          x: 0,
          y: 0.26,
          z: 0,
          w: FURN_SPECS[f.kind].size[0],
          h: 0.52,
          d: FURN_SPECS[f.kind].size[1],
        },
        'mid'
      );
      break;
    case 'crate':
      add({ x: 0, y: 0.35, z: 0, w: 0.75, h: 0.7, d: 0.75 }, 'mid');
      break;
    case 'cratestack':
      add({ x: -0.35, y: 0.4, z: 0.3, w: 0.72, h: 0.8, d: 0.72 }, 'mid');
      add({ x: 0.42, y: 0.32, z: -0.15, w: 0.62, h: 0.64, d: 0.62 }, 'mid');
      add({ x: -0.2, y: 1.1, z: 0.25, w: 0.6, h: 0.6, d: 0.6 }, 'mid');
      break;
    case 'workbench':
      add({ x: 0, y: 0.82, z: 0, w: 2.0, h: 0.07, d: 0.75 }, 'mid');
      add({ x: -0.85, y: 0.4, z: 0, w: 0.12, h: 0.8, d: 0.65 }, 'mid');
      add({ x: 0.85, y: 0.4, z: 0, w: 0.12, h: 0.8, d: 0.65 }, 'mid');
      add({ x: 0, y: 1.55, z: 0.34, w: 1.9, h: 0.9, d: 0.05 }, 'mid');
      break;
    case 'boiler':
      add({ x: 0, y: 1.0, z: 0, w: 1.1, h: 2.0, d: 1.1 }, 'metal');
      add({ x: -0.4, y: 2.2, z: 0, w: 0.14, h: 0.9, d: 0.14 }, 'metal');
      add({ x: 0.35, y: 2.3, z: 0.2, w: 0.1, h: 1.1, d: 0.1 }, 'metal');
      break;
    case 'generator':
      add({ x: 0, y: 0.42, z: 0, w: 1.1, h: 0.7, d: 0.6 }, 'metal');
      add({ x: -0.35, y: 0.85, z: 0, w: 0.25, h: 0.16, d: 0.25 }, 'metal');
      break;
    case 'car': {
      add({ x: 0, y: 0.55, z: 0, w: 1.85, h: 0.55, d: 4.3 }, 'metal');
      add({ x: 0, y: 1.06, z: 0.25, w: 1.7, h: 0.5, d: 2.2 }, 'metal');
      for (const [lx, lz] of [
        [-0.85, -1.45],
        [0.85, -1.45],
        [-0.85, 1.45],
        [0.85, 1.45],
      ]) {
        add({ x: lx, y: 0.34, z: lz, w: 0.22, h: 0.68, d: 0.68 }, 'fabric');
      }
      break;
    }
    case 'piano':
      add({ x: 0, y: 0.65, z: 0.15, w: 1.5, h: 1.3, d: 0.65 });
      add({ x: 0, y: 0.78, z: -0.32, w: 1.4, h: 0.08, d: 0.3 }, 'porcelain');
      break;
    case 'radio':
      add({ x: 0, y: 0.42, z: 0, w: 0.6, h: 0.85, d: 0.35 });
      add({ x: 0, y: 0.62, z: -0.16, w: 0.4, h: 0.3, d: 0.04 }, 'fabric');
      break;
    case 'clock':
      add({ x: 0, y: 1.02, z: 0, w: 0.55, h: 2.05, d: 0.32 });
      add({ x: 0, y: 1.72, z: -0.14, w: 0.36, h: 0.36, d: 0.04 }, 'porcelain');
      break;
    case 'coatstand':
      add({ x: 0, y: 0.9, z: 0, w: 0.06, h: 1.8, d: 0.06 });
      add({ x: 0, y: 1.7, z: 0, w: 0.5, h: 0.05, d: 0.5 });
      break;
    case 'mannequin':
      add({ x: 0, y: 1.05, z: 0, w: 0.38, h: 0.8, d: 0.24 }, 'fabric');
      add({ x: 0, y: 0.45, z: 0, w: 0.1, h: 0.5, d: 0.1 }, 'mid');
      add({ x: 0, y: 1.6, z: 0, w: 0.2, h: 0.24, d: 0.2 }, 'porcelain');
      break;
    case 'rockinghorse':
      add({ x: 0, y: 0.45, z: 0, w: 0.22, h: 0.35, d: 0.75 }, 'mid');
      add({ x: 0, y: 0.68, z: -0.3, w: 0.16, h: 0.3, d: 0.2 }, 'mid');
      add({ x: 0, y: 0.08, z: 0, w: 0.7, h: 0.08, d: 0.9 }, 'mid');
      break;
    case 'rockingchair':
      add({ x: 0, y: 0.42, z: 0, w: 0.6, h: 0.06, d: 0.55 }, 'mid');
      add({ x: 0, y: 0.75, z: 0.24, w: 0.6, h: 0.7, d: 0.05 }, 'mid');
      add({ x: 0, y: 0.06, z: 0, w: 0.66, h: 0.06, d: 0.95 }, 'mid');
      break;
    case 'mirror':
      add({ x: 0, y: 0.85, z: 0, w: 0.8, h: 1.7, d: 0.08 });
      break;
    case 'lamp':
      add({ x: 0, y: 0.72, z: 0, w: 0.05, h: 1.44, d: 0.05 }, 'metal');
      add({ x: 0, y: 1.48, z: 0, w: 0.32, h: 0.24, d: 0.32 }, 'fabric');
      break;
    case 'rug':
      add({ x: 0, y: 0.012, z: 0, w: 2.6, h: 0.024, d: 1.8 }, 'fabric');
      break;
    case 'barrel':
      add({ x: 0, y: 0.42, z: 0, w: 0.62, h: 0.85, d: 0.62 }, 'mid');
      break;
    case 'firewood':
      add({ x: 0, y: 0.18, z: 0, w: 1.1, h: 0.36, d: 0.5 }, 'mid');
      add({ x: 0, y: 0.5, z: 0, w: 0.9, h: 0.28, d: 0.42 }, 'mid');
      break;
    case 'bin':
      add({ x: 0, y: 0.37, z: 0, w: 0.55, h: 0.75, d: 0.55 }, 'metal');
      break;
    case 'safe':
      add({ x: 0, y: 0.42, z: 0, w: 0.7, h: 0.85, d: 0.6 }, 'metal');
      break;
    case 'fusebox':
      // panel is fully interactive — no static shell
      break;
    default:
      break;
  }
  return { boxes: b };
}

/* ------------------------------------------------------------------ */
/* Static merged shells + colliders                                    */
/* ------------------------------------------------------------------ */

function FurnitureStatic() {
  const { batches, colliders } = useMemo(() => {
    const groups = new Map<MatKey, BoxSpec[]>();
    const colliders: { pos: Vec3; half: Vec3; rotY: number }[] = [];
    for (const f of FURNITURE) {
      const y = FLOOR_Y[f.floor];
      const rot = f.rotY ?? 0;
      const shell = buildShell(f);
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      for (const { spec, mat } of shell.boxes) {
        const wx = f.pos[0] + spec.x * cos + spec.z * sin;
        const wz = f.pos[1] - spec.x * sin + spec.z * cos;
        const list = groups.get(mat) ?? [];
        list.push({ ...spec, x: wx, y: y + spec.y, z: wz, rotY: rot });
        groups.set(mat, list);
      }
      const fs = FURN_SPECS[f.kind];
      if (fs.solid && f.kind !== 'rug') {
        colliders.push({
          pos: [f.pos[0], y + fs.size[2] / 2, f.pos[1]],
          half: [fs.size[0] / 2, fs.size[2] / 2, fs.size[1] / 2],
          rotY: rot,
        });
      }
    }
    const batches: { key: string; geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    for (const [mat, specs] of groups) {
      const geometry = mergeBoxes(specs);
      if (geometry) batches.push({ key: mat, geometry, material: matOf(mat) });
    }
    return { batches, colliders };
  }, []);

  return (
    <group>
      {batches.map((b) => (
        <mesh key={b.key} geometry={b.geometry} material={b.material} castShadow receiveShadow />
      ))}
      <RigidBody type="fixed" colliders={false} userData={{ kind: 'furniture' }}>
        {colliders.map((c, i) => (
          <CuboidCollider key={i} args={c.half} position={c.pos} rotation={[0, c.rotY, 0]} />
        ))}
      </RigidBody>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const spawnByContainer = new Map(
  SPAWN_POINTS.filter((s) => s.container).map((s) => [s.container as string, s])
);

function furnWorld(f: FurnDef, lx: number, ly: number, lz: number): THREE.Vector3 {
  const rot = f.rotY ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return new THREE.Vector3(
    f.pos[0] + lx * cos + lz * sin,
    FLOOR_Y[f.floor] + ly,
    f.pos[1] - lx * sin + lz * cos
  );
}

function giveSpawnContent(spawnId: string): void {
  const g = useGame.getState();
  const run = g.run;
  if (!run) return;
  const content = run.contents[spawnId];
  g.takeSpawn(spawnId);
  if (!content || content.type === 'empty') {
    useHud.getState().toast('Nothing but dust.');
    return;
  }
  if (content.type === 'item') {
    AudioEngine.play('pickup', { volume: 0.9 });
    g.addItem(content.id);
  } else {
    AudioEngine.play('paper', { volume: 0.9 });
    g.collectNote(content.id);
    g.openNote(content.id);
  }
}

/* ------------------------------------------------------------------ */
/* Searchable container (with drawer animation)                        */
/* ------------------------------------------------------------------ */

const DRAWER_KINDS = new Set(['sideboard', 'dresser', 'nightstand', 'desk', 'cabinet', 'counter']);
const LID_KINDS = new Set(['toychest', 'trunk']);

function Container({ f }: { f: FurnDef }) {
  const spawn = spawnByContainer.get(f.id);
  const open = useRef(0);
  const openTarget = useRef(0);
  const drawerRef = useRef<THREE.Mesh>(null);
  const lidRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => furnWorld(f, 0, 0.7, -0.3), [f]);

  useEffect(() => {
    if (!spawn) return;
    return registerInteractable({
      id: `search_${f.id}`,
      pos,
      radius: 1.7,
      prompt: () => {
        const g = useGame.getState();
        if (g.searchedContainers.includes(f.id)) return '';
        return `Search ${spawn.where}`;
      },
      enabled: () => !useGame.getState().searchedContainers.includes(f.id),
      action: () => {
        const g = useGame.getState();
        if (g.searchedContainers.includes(f.id)) return;
        g.markSearched(f.id);
        openTarget.current = 1;
        AudioEngine.play3d(DRAWER_KINDS.has(f.kind) ? 'drawer' : 'rummage', pos, { volume: 0.9 });
        emitNoise(pos.x, pos.y, pos.z, 0.35, 'drawer');
        window.setTimeout(() => giveSpawnContent(spawn.id), 650);
      },
    });
  }, [f, pos, spawn]);

  useFrame((_, dt) => {
    open.current = damp(open.current, openTarget.current, 5, Math.min(dt, 0.05));
    if (drawerRef.current) drawerRef.current.position.z = -0.28 - open.current * 0.3;
    if (lidRef.current) lidRef.current.rotation.x = -open.current * 1.1;
  });

  if (!spawn) return null;
  const rot = f.rotY ?? 0;
  const y = FLOOR_Y[f.floor];

  if (DRAWER_KINDS.has(f.kind)) {
    return (
      <group position={[f.pos[0], y, f.pos[1]]} rotation={[0, rot, 0]}>
        <mesh ref={drawerRef} position={[0, 0.66, -0.28]} castShadow material={MAT.midWood()}>
          <boxGeometry args={[Math.min(0.9, FURN_SPECS[f.kind].size[0] - 0.2), 0.18, 0.42]} />
        </mesh>
      </group>
    );
  }
  if (LID_KINDS.has(f.kind)) {
    return (
      <group position={[f.pos[0], y, f.pos[1]]} rotation={[0, rot, 0]}>
        <group ref={lidRef} position={[0, 0.52, 0.28]}>
          <mesh position={[0, 0.02, -0.28]} castShadow material={MAT.midWood()}>
            <boxGeometry args={[FURN_SPECS[f.kind].size[0], 0.05, FURN_SPECS[f.kind].size[1]]} />
          </mesh>
        </group>
      </group>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Hiding places                                                       */
/* ------------------------------------------------------------------ */

function HideableFurniture({ f }: { f: FurnDef }) {
  const spot = useMemo(() => HIDE_SPOTS.find((h) => h.id === f.id), [f.id]);
  const doorOpen = useRef(0);
  const doorTarget = useRef(0);
  const doorL = useRef<THREE.Group>(null);
  const doorR = useRef<THREE.Group>(null);
  const isWardrobe = f.kind === 'wardrobe' || f.kind === 'pantry';

  useEffect(() => {
    if (!spot) return;
    const entry = furnWorld(f, 0, 1.0, -(FURN_SPECS[f.kind].size[1] / 2 + 0.4));
    return registerInteractable({
      id: `hide_${f.id}`,
      pos: entry,
      radius: 1.6,
      prompt: () =>
        f.kind === 'pantry'
          ? 'Hide in the pantry'
          : isWardrobe
            ? 'Hide in the wardrobe'
            : 'Hide under the bed',
      enabled: () => !RT.player.hidden,
      action: () => {
        const p = RT.player;
        if (p.hidden) return;
        const eye = new THREE.Vector3(spot.inside[0], spot.inside[1], spot.inside[2]);
        const exit = new THREE.Vector3(spot.checkFrom[0], FLOOR_Y[spot.floor], spot.checkFrom[2]);
        p.hidden = {
          kind: spot.kind,
          id: spot.id,
          eye,
          exit,
          enteredSeen:
            RT.enemy.active && RT.enemy.awareness > 0.7 && RT.enemy.pos.distanceTo(p.pos) < 13,
        };
        p.pos.copy(eye).setY(exit.y);
        RT.habits.hideCounts[spot.kind] = (RT.habits.hideCounts[spot.kind] ?? 0) + 1;
        doorTarget.current = 1;
        window.setTimeout(() => {
          doorTarget.current = 0;
        }, 450);
        AudioEngine.play3d('wardrobe_door', entry, { volume: 0.8 });
        emitNoise(entry.x, entry.y, entry.z, p.hidden.enteredSeen ? 0.5 : 0.3, 'door');
      },
    });
  }, [f, spot, isWardrobe]);

  useFrame((_, dt) => {
    doorOpen.current = damp(doorOpen.current, doorTarget.current, 8, Math.min(dt, 0.05));
    if (doorL.current) doorL.current.rotation.y = -doorOpen.current * 1.7;
    if (doorR.current) doorR.current.rotation.y = doorOpen.current * 1.7;
  });

  if (!spot || !isWardrobe) return null;
  const y = FLOOR_Y[f.floor];
  const w = FURN_SPECS[f.kind].size[0];
  const front = -FURN_SPECS[f.kind].size[1] / 2;
  return (
    <group position={[f.pos[0], y, f.pos[1]]} rotation={[0, f.rotY ?? 0, 0]}>
      <group ref={doorL} position={[-w / 2 + 0.03, 0, front]}>
        <mesh position={[w / 4, 1.05, 0]} castShadow material={MAT.darkWood()}>
          <boxGeometry args={[w / 2 - 0.05, 2.02, 0.05]} />
        </mesh>
      </group>
      <group ref={doorR} position={[w / 2 - 0.03, 0, front]}>
        <mesh position={[-w / 4, 1.05, 0]} castShadow material={MAT.darkWood()}>
          <boxGeometry args={[w / 2 - 0.05, 2.02, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The study safe                                                      */
/* ------------------------------------------------------------------ */

function StudySafe() {
  const f = FURNITURE.find((x) => x.id === 'study_safe')!;
  const doorRef = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const pos = useMemo(() => furnWorld(f, 0, 0.45, -0.4), [f]);

  useEffect(() => {
    const un1 = registerInteractable({
      id: 'safe_dial',
      pos,
      radius: 1.5,
      prompt: () => (useGame.getState().flags.safeOpen ? '' : 'Try the safe dial'),
      enabled: () => !useGame.getState().flags.safeOpen,
      action: () => {
        useGame.getState().setOverlay('safe');
      },
    });
    const un2 = registerInteractable({
      id: 'safe_loot',
      pos,
      radius: 1.4,
      prompt: () => {
        const g = useGame.getState();
        const item = g.run?.safeLoot;
        return item ? `Take the ${ITEMS[item].name}` : '';
      },
      enabled: () => {
        const g = useGame.getState();
        return g.flags.safeOpen && !g.takenSpawns.includes('safe_loot');
      },
      action: () => {
        const g = useGame.getState();
        if (!g.run) return;
        g.takeSpawn('safe_loot');
        AudioEngine.play('pickup', { volume: 0.9 });
        g.addItem(g.run.safeLoot);
      },
    });
    return () => {
      un1();
      un2();
    };
  }, [pos]);

  useFrame((_, dt) => {
    const open = useGame.getState().flags.safeOpen;
    angle.current = damp(angle.current, open ? 1.9 : 0, 4, Math.min(dt, 0.05));
    if (doorRef.current) doorRef.current.rotation.y = angle.current;
  });

  const g = useGame((s) => s.flags.safeOpen);
  const taken = useGame((s) => s.takenSpawns.includes('safe_loot'));
  const run = useGame((s) => s.run);

  return (
    <group position={[f.pos[0], FLOOR_Y[f.floor], f.pos[1]]} rotation={[0, f.rotY ?? 0, 0]}>
      <group ref={doorRef} position={[-0.33, 0, -0.31]}>
        <mesh position={[0.33, 0.45, 0]} castShadow material={MAT.metalDark()}>
          <boxGeometry args={[0.62, 0.72, 0.05]} />
        </mesh>
        <mesh position={[0.42, 0.45, -0.05]} material={MAT.metal()}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
        </mesh>
      </group>
      {g && !taken && run && (
        <mesh position={[0, 0.35, 0]} material={MAT.metal()}>
          <boxGeometry args={[0.2, 0.12, 0.14]} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Secret passages                                                     */
/* ------------------------------------------------------------------ */

function SecretBookcase() {
  const f = FURNITURE.find((x) => x.id === 'lib_shelf_secret')!;
  const slide = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => furnWorld(f, 0, 1.2, -0.5), [f]);

  useEffect(() => {
    return registerInteractable({
      id: 'bookcase_secret',
      pos,
      radius: 1.7,
      prompt: () => {
        const g = useGame.getState().flags;
        return g.bookcaseOpen ? '' : 'One book is worn shiny — pull it';
      },
      enabled: () => !useGame.getState().flags.bookcaseOpen,
      action: () => {
        const g = useGame.getState();
        g.setFlag('bookcaseOpen');
        AudioEngine.play3d('shelf_slide', pos, { volume: 1 });
        emitNoise(pos.x, pos.y, pos.z, 0.6, 'impact');
        useHud.getState().toast('The bookcase swings inward. A hidden way into the study.');
      },
    });
  }, [pos]);

  useFrame((_, dt) => {
    const open = useGame.getState().flags.bookcaseOpen;
    slide.current = damp(slide.current, open ? 1 : 0, 2.2, Math.min(dt, 0.05));
    if (groupRef.current) {
      groupRef.current.rotation.y = (f.rotY ?? 0) + slide.current * 1.35;
    }
  });

  // Bookcase mesh (mirrors the static bookshelf, but as its own hinged mesh).
  const collOpen = useGame((s) => s.flags.bookcaseOpen);
  return (
    <group position={[f.pos[0], FLOOR_Y[f.floor], f.pos[1]]}>
      <group ref={groupRef} rotation={[0, f.rotY ?? 0, 0]} position={[0, 0, 0]}>
        <group position={[0, 0, 0]}>
          <mesh position={[0, 1.1, 0.14]} castShadow material={MAT.darkWood()}>
            <boxGeometry args={[1.5, 2.2, 0.14]} />
          </mesh>
          <mesh position={[0, 1.08, -0.02]} castShadow material={MAT.books()}>
            <boxGeometry args={[1.38, 2.0, 0.3]} />
          </mesh>
        </group>
      </group>
      {!collOpen && (
        <RigidBody type="fixed" colliders={false} userData={{ kind: 'furniture' }}>
          <CuboidCollider
            args={[0.75, 1.1, 0.22]}
            position={[0, 1.1, 0]}
            rotation={[0, f.rotY ?? 0, 0]}
          />
        </RigidBody>
      )}
    </group>
  );
}

function SecretShelf() {
  // Heavy shelf hiding the forgotten room (basement corridor, east wall).
  const slide = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const base = useMemo(() => new THREE.Vector3(3.9, FLOOR_Y.basement, -3), []);
  const pos = useMemo(() => new THREE.Vector3(3.75, FLOOR_Y.basement + 1.2, -3), []);

  useEffect(() => {
    return registerInteractable({
      id: 'shelf_secret',
      pos,
      radius: 1.8,
      prompt: () => {
        const fl = useGame.getState().flags;
        if (fl.shelfMoved) return '';
        return 'Scrape marks on the floor… drag the shelf aside';
      },
      enabled: () => !useGame.getState().flags.shelfMoved,
      action: () => {
        const g = useGame.getState();
        g.setFlag('shelfMoved');
        AudioEngine.play3d('shelf_slide', pos, { volume: 1 });
        emitNoise(pos.x, pos.y, pos.z, 0.8, 'impact');
        useHud.getState().toast('Cold air breathes out of the dark behind it.');
        if (!g.flags.sawHatch) {
          g.addObjective('obj_forgotten', 'Explore the forgotten room');
          g.completeObjective('obj_forgotten');
        }
      },
    });
  }, [pos]);

  useFrame((_, dt) => {
    const open = useGame.getState().flags.shelfMoved;
    slide.current = damp(slide.current, open ? 1 : 0, 2, Math.min(dt, 0.05));
    if (groupRef.current) groupRef.current.position.z = base.z + slide.current * 1.55;
  });

  const moved = useGame((s) => s.flags.shelfMoved);
  return (
    <>
      <group ref={groupRef} position={[base.x, base.y, base.z]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[-0.77, 0.95, 0]} castShadow material={MAT.midWood()}>
          <boxGeometry args={[0.06, 1.9, 0.45]} />
        </mesh>
        <mesh position={[0.77, 0.95, 0]} castShadow material={MAT.midWood()}>
          <boxGeometry args={[0.06, 1.9, 0.45]} />
        </mesh>
        {[0.3, 0.85, 1.4, 1.86].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow material={MAT.midWood()}>
            <boxGeometry args={[1.6, 0.05, 0.45]} />
          </mesh>
        ))}
        <mesh position={[0, 0.6, 0]} material={MAT.metal()}>
          <boxGeometry args={[0.5, 0.3, 0.3]} />
        </mesh>
      </group>
      {!moved && (
        <RigidBody type="fixed" colliders={false} userData={{ kind: 'furniture' }}>
          <CuboidCollider args={[0.25, 1.0, 0.85]} position={[3.9, FLOOR_Y.basement + 1, -3]} />
        </RigidBody>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fuse panel, generator, boiler                                       */
/* ------------------------------------------------------------------ */

function FusePanel() {
  const f = FURNITURE.find((x) => x.id === 'boi_fuse')!;
  const pos = useMemo(() => furnWorld(f, 0, 1.4, -0.15), [f]);
  const coverRef = useRef<THREE.Group>(null);
  const openAmt = useRef(0);

  useEffect(() => {
    return registerInteractable({
      id: 'fuse_panel',
      pos,
      radius: 1.7,
      priority: 1,
      prompt: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawPanel) return 'Inspect the mains panel';
        if (!fl.panelOpened) {
          return g.hasItem('wire_cutters')
            ? 'Cut the wire holding the cover'
            : 'The cover is wired shut';
        }
        if (!fl.fuseInstalled) {
          return g.hasItem('fuse') ? 'Fit the fuse' : 'The main fuse is missing';
        }
        if (!fl.powerOn) return 'Throw the main breaker';
        return 'The panel hums steadily';
      },
      action: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawPanel) {
          g.setFlag('sawPanel');
          useHud.getState().toast('The mains panel: cover wired shut, main fuse gone.');
          AudioEngine.play3d('switch_click', pos, { volume: 0.6 });
          return;
        }
        if (!fl.panelOpened) {
          if (g.hasItem('wire_cutters')) {
            g.setFlag('panelOpened');
            AudioEngine.play3d('chain_cut', pos, { volume: 0.8 });
            emitNoise(pos.x, pos.y, pos.z, 0.3, 'impact');
          } else {
            useHud.getState().toast('Twisted wire seals the cover. You need cutters.');
          }
          return;
        }
        if (!fl.fuseInstalled) {
          if (g.hasItem('fuse')) {
            g.removeItem('fuse');
            g.setFlag('fuseInstalled');
            AudioEngine.play3d('switch_click', pos, { volume: 0.9 });
            useHud.getState().toast('The fuse seats with a clean click.');
          } else {
            useHud.getState().toast('An empty fuse socket. Find a 30A fuse.');
          }
          return;
        }
        if (!fl.powerOn) {
          g.setFlag('powerOn');
          AudioEngine.play3d('breaker_on', pos, { volume: 1 });
          emitNoise(pos.x, pos.y, pos.z, 0.85, 'machine');
          RT.shake = Math.min(1, RT.shake + 0.2);
        }
      },
    });
  }, [pos]);

  useFrame((_, dt) => {
    const opened = useGame.getState().flags.panelOpened;
    openAmt.current = damp(openAmt.current, opened ? 1 : 0, 5, Math.min(dt, 0.05));
    if (coverRef.current) coverRef.current.rotation.y = -openAmt.current * 2.0;
  });

  const powerOn = useGame((s) => s.flags.powerOn);

  useEffect(() => {
    if (powerOn) {
      AudioEngine.setLoop('panel_buzz', 'buzz', 0.6, { pos: [pos.x, pos.y, pos.z], bus: 'sfx' });
    }
    return () => AudioEngine.stopLoop('panel_buzz');
  }, [powerOn, pos]);

  return (
    <group position={[f.pos[0], FLOOR_Y[f.floor] + 1.15, f.pos[1]]} rotation={[0, f.rotY ?? 0, 0]}>
      <mesh castShadow material={MAT.metalDark()}>
        <boxGeometry args={[0.6, 0.8, 0.16]} />
      </mesh>
      <group ref={coverRef} position={[-0.3, 0, -0.09]}>
        <mesh position={[0.3, 0, 0]} material={MAT.metal()}>
          <boxGeometry args={[0.58, 0.76, 0.03]} />
        </mesh>
      </group>
      <mesh position={[0, 0.12, -0.06]} material={MAT.metalDark()}>
        <boxGeometry args={[0.08, 0.16, 0.06]} />
      </mesh>
      {powerOn && (
        <mesh position={[0.18, 0.28, -0.09]}>
          <sphereGeometry args={[0.02, 6, 5]} />
          <meshStandardMaterial color="#220b06" emissive="#ff3b1f" emissiveIntensity={2.2} />
        </mesh>
      )}
    </group>
  );
}

function Generator() {
  const f = FURNITURE.find((x) => x.id === 'gar_gen')!;
  const pos = useMemo(() => furnWorld(f, 0, 0.7, -0.4), [f]);
  const noiseTimer = useRef(0);

  useEffect(() => {
    return registerInteractable({
      id: 'generator',
      pos,
      radius: 1.7,
      prompt: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawGenerator) return 'Inspect the generator';
        if (!fl.generatorFueled) return g.hasItem('gas_can') ? 'Fill the tank' : 'Tank is bone dry';
        if (!fl.generatorOn) return 'Pull the starter cord (LOUD)';
        return 'Running';
      },
      action: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawGenerator) {
          g.setFlag('sawGenerator');
          useHud.getState().toast('A backup generator. It could power the garage door — loudly.');
          return;
        }
        if (!fl.generatorFueled) {
          if (g.hasItem('gas_can')) {
            g.removeItem('gas_can');
            g.setFlag('generatorFueled');
            AudioEngine.play3d('cloth', pos, { volume: 0.8 });
            useHud.getState().toast('Fuel glugs into the tank.');
          } else {
            useHud
              .getState()
              .toast('The tank is dry. There must be fuel somewhere on the property.');
          }
          return;
        }
        if (!fl.generatorOn) {
          g.setFlag('generatorOn');
          AudioEngine.play3d('generator_start', pos, { volume: 1 });
          emitNoise(pos.x, pos.y, pos.z, 1.3, 'machine');
          useHud.getState().toast('The generator roars to life. Everything heard that.');
        }
      },
    });
  }, [pos]);

  useFrame((_, dt) => {
    const g = useGame.getState();
    if (!g.flags.generatorOn) return;
    AudioEngine.setLoop('generator', 'generator_loop', 0.9, {
      pos: [pos.x, pos.y, pos.z],
      bus: 'sfx',
    });
    noiseTimer.current -= dt;
    if (noiseTimer.current <= 0) {
      noiseTimer.current = 2.4;
      emitNoise(pos.x, pos.y, pos.z, 0.5, 'machine', false);
    }
  });

  return null; // shell rendered statically; interactions only
}

function BoilerAmbience() {
  const f = FURNITURE.find((x) => x.id === 'boi_boiler')!;
  const pos = useMemo(() => furnWorld(f, 0, 1, 0), [f]);
  useEffect(() => {
    AudioEngine.setLoop('boiler', 'boiler_loop', 0.7, {
      pos: [pos.x, pos.y, pos.z],
      bus: 'ambience',
    });
    return () => AudioEngine.stopLoop('boiler');
  }, [pos]);
  return null;
}

/* ------------------------------------------------------------------ */
/* The estate car — one of the escapes                                 */
/* ------------------------------------------------------------------ */

function EstateCar() {
  const f = FURNITURE.find((x) => x.id === 'gar_car')!;
  const doorPos = useMemo(() => furnWorld(f, -1.05, 1.0, 0.3), [f]);
  const escaping = useRef(false);

  useEffect(() => {
    return registerInteractable({
      id: 'car_door',
      pos: doorPos,
      radius: 1.8,
      priority: 1,
      prompt: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawCar) return 'An old estate car under a tarp';
        if (!fl.carUnlocked)
          return g.hasItem('key_car') ? 'Unlock the car' : 'Locked. It needs its key';
        if (!fl.garageOpen) return 'Get in — but the garage door is shut';
        return 'Get in and drive';
      },
      action: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (escaping.current) return;
        if (!fl.sawCar) {
          g.setFlag('sawCar');
          useHud.getState().toast('The family car. If it still runs, it is a way out.');
          return;
        }
        if (!fl.carUnlocked) {
          if (g.hasItem('key_car')) {
            g.setFlag('carUnlocked');
            AudioEngine.play3d('door_unlock', doorPos, { volume: 0.9 });
          } else {
            AudioEngine.play3d('door_locked', doorPos, { volume: 0.8 });
            emitNoise(doorPos.x, doorPos.y, doorPos.z, 0.25, 'door');
          }
          return;
        }
        if (!fl.garageOpen) {
          useHud.getState().toast('The garage door is down. Driving through it is not an option.');
          return;
        }
        // Escape.
        escaping.current = true;
        AudioEngine.play3d('car_start', doorPos, { volume: 1 });
        emitNoise(doorPos.x, doorPos.y, doorPos.z, 1.2, 'machine');
        window.setTimeout(() => {
          useGame.getState().win('car');
        }, 2600);
      },
    });
  }, [doorPos]);

  return null;
}

/* ------------------------------------------------------------------ */
/* The cellar hatch — the forgotten escape                             */
/* ------------------------------------------------------------------ */

function CellarHatch() {
  const pos = useMemo(() => new THREE.Vector3(5, FLOOR_Y.basement + 0.1, -4.4), []);
  const lidRef = useRef<THREE.Mesh>(null);
  const openAmt = useRef(0);

  useEffect(() => {
    return registerInteractable({
      id: 'cellar_hatch',
      pos: new THREE.Vector3(pos.x, pos.y + 0.4, pos.z),
      radius: 1.8,
      priority: 1,
      prompt: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawHatch) return 'A hatch set into the floor';
        if (!fl.hatchPried) {
          return g.hasItem('crowbar') ? 'Pry the rusted plate off' : 'A rusted plate seals it';
        }
        if (!fl.hatchOpen) return 'A number lock — enter the code';
        return 'Climb down into the tunnel';
      },
      action: () => {
        const g = useGame.getState();
        const fl = g.flags;
        if (!fl.sawHatch) {
          g.setFlag('sawHatch');
          useHud
            .getState()
            .toast('A storm tunnel, the note said. Sealed with a plate and a number lock.');
          return;
        }
        if (!fl.hatchPried) {
          if (g.hasItem('crowbar')) {
            g.setFlag('hatchPried');
            AudioEngine.play3d('pry', pos, { volume: 1 });
            emitNoise(pos.x, pos.y, pos.z, 0.8, 'impact');
          } else {
            useHud.getState().toast('The plate will not budge with bare hands.');
          }
          return;
        }
        if (!fl.hatchOpen) {
          g.openKeypad('hatch');
          return;
        }
        // Escape.
        AudioEngine.play('ladder', { volume: 0.9 });
        window.setTimeout(() => useGame.getState().win('tunnel'), 1200);
      },
    });
  }, [pos]);

  useFrame((_, dt) => {
    const open = useGame.getState().flags.hatchOpen;
    openAmt.current = damp(openAmt.current, open ? 1 : 0, 3, Math.min(dt, 0.05));
    if (lidRef.current) lidRef.current.rotation.x = -openAmt.current * 1.8;
  });

  const pried = useGame((s) => s.flags.hatchPried);
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh position={[0, 0.01, 0]} receiveShadow material={MAT.metalDark()}>
        <boxGeometry args={[1.0, 0.06, 1.0]} />
      </mesh>
      <mesh ref={lidRef} position={[0, 0.08, -0.45]} castShadow material={MAT.metal()}>
        <boxGeometry args={[0.9, 0.05, 0.9]} />
      </mesh>
      {!pried && (
        <mesh position={[0, 0.1, 0]} material={MAT.metal()}>
          <boxGeometry args={[1.02, 0.05, 0.3]} />
        </mesh>
      )}
      <mesh position={[0.35, 0.12, 0.35]} material={MAT.metalDark()}>
        <boxGeometry args={[0.16, 0.08, 0.16]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Attic ladder                                                        */
/* ------------------------------------------------------------------ */

function AtticLadder() {
  const hx = ATTIC_HATCH.pos[0];
  const hz = ATTIC_HATCH.pos[1];
  const drop = useRef(0);

  useEffect(() => {
    const unPull = registerInteractable({
      id: 'attic_pull',
      pos: new THREE.Vector3(hx, ATTIC_HATCH.upperY + 2.2, hz),
      radius: 2.2,
      prompt: () =>
        useGame.getState().flags.atticLadder ? 'Fold the ladder away' : 'Pull the attic hatch cord',
      enabled: () => RT.player.floor === 'upper',
      action: () => {
        const g = useGame.getState();
        g.setFlag('atticLadder', !g.flags.atticLadder);
        AudioEngine.play3d('hatch_open', [hx, ATTIC_HATCH.upperY + 2.6, hz], { volume: 0.9 });
        emitNoise(hx, ATTIC_HATCH.upperY + 2, hz, 0.5, 'impact');
      },
    });
    const unUp = registerInteractable({
      id: 'attic_climb_up',
      pos: new THREE.Vector3(hx, ATTIC_HATCH.upperY + 1.2, hz),
      radius: 1.5,
      prompt: () => 'Climb up to the attic',
      enabled: () => useGame.getState().flags.atticLadder && RT.player.floor === 'upper',
      action: () => {
        RT.pendingClimb = {
          from: RT.player.pos.clone(),
          to: new THREE.Vector3(hx, ATTIC_HATCH.atticY + 0.05, hz - 1.1),
        };
      },
    });
    const unDown = registerInteractable({
      id: 'attic_climb_down',
      pos: new THREE.Vector3(hx, ATTIC_HATCH.atticY + 0.6, hz - 0.6),
      radius: 1.7,
      prompt: () => 'Climb down',
      enabled: () => useGame.getState().flags.atticLadder && RT.player.floor === 'attic',
      action: () => {
        RT.pendingClimb = {
          from: RT.player.pos.clone(),
          to: new THREE.Vector3(hx, ATTIC_HATCH.upperY + 0.05, hz + 0.7),
        };
      },
    });
    return () => {
      unPull();
      unUp();
      unDown();
    };
  }, [hx, hz]);

  useFrame((_, dt) => {
    const open = useGame.getState().flags.atticLadder;
    drop.current = damp(drop.current, open ? 1 : 0, 4, Math.min(dt, 0.05));
  });

  const open = useGame((s) => s.flags.atticLadder);
  return (
    <group position={[hx, ATTIC_HATCH.upperY, hz]}>
      {/* hatch frame in the ceiling */}
      <mesh position={[0, 2.94, 0]} material={MAT.trim()}>
        <boxGeometry args={[1.3, 0.06, 1.2]} />
      </mesh>
      {open && (
        <group rotation={[0.32, 0, 0]} position={[0, 2.9, 0.1]}>
          {/* rails */}
          <mesh position={[-0.35, -1.45, 0]} material={MAT.midWood()} castShadow>
            <boxGeometry args={[0.07, 2.95, 0.09]} />
          </mesh>
          <mesh position={[0.35, -1.45, 0]} material={MAT.midWood()} castShadow>
            <boxGeometry args={[0.07, 2.95, 0.09]} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[0, -0.3 - i * 0.3, 0]} material={MAT.midWood()}>
              <boxGeometry args={[0.66, 0.05, 0.09]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Radio, piano, clocks                                                */
/* ------------------------------------------------------------------ */

function RadioLure() {
  const f = FURNITURE.find((x) => x.id === 'lou_radio')!;
  const pos = useMemo(() => furnWorld(f, 0, 0.6, 0), [f]);
  const noiseTimer = useRef(0);

  useEffect(() => {
    return registerInteractable({
      id: 'radio',
      pos,
      radius: 1.6,
      prompt: () =>
        useGame.getState().flags.radioOn ? 'Switch the wireless off' : 'Switch the wireless on',
      action: () => {
        const g = useGame.getState();
        g.setFlag('radioOn', !g.flags.radioOn);
        AudioEngine.play3d('switch_click', pos, { volume: 0.8 });
        if (!g.flags.radioOn) {
          useHud.getState().toast('A thin waltz crackles out. Anything could hear this.');
        }
      },
    });
  }, [pos]);

  useFrame((_, dt) => {
    const on = useGame.getState().flags.radioOn;
    AudioEngine.setLoop('radio', 'radio_waltz', on ? 0.8 : 0, {
      pos: [pos.x, pos.y, pos.z],
      bus: 'sfx',
    });
    if (on) {
      noiseTimer.current -= dt;
      if (noiseTimer.current <= 0) {
        noiseTimer.current = 3;
        emitNoise(pos.x, pos.y, pos.z, 0.75, 'lure', false);
      }
    }
  });
  return null;
}

function PianoEntity() {
  const f = FURNITURE.find((x) => x.id === 'liv_piano')!;
  const pos = useMemo(() => furnWorld(f, 0, 0.9, -0.5), [f]);
  useEffect(() => {
    return registerInteractable({
      id: 'piano',
      pos,
      radius: 1.6,
      prompt: () => 'Press a key',
      action: () => {
        AudioEngine.play3d('piano_hit', pos, { volume: 1 });
        emitNoise(pos.x, pos.y, pos.z, 0.9, 'lure');
        useHud.getState().toast('The chord hangs in the air far too long.');
      },
    });
  }, [pos]);
  return null;
}

function ClockAmbience() {
  useEffect(() => {
    const c1 = FURNITURE.find((x) => x.id === 'hall_clock')!;
    const p = furnWorld(c1, 0, 1.6, 0);
    AudioEngine.setLoop('clock', 'clock_tick', 0.55, { pos: [p.x, p.y, p.z], bus: 'ambience' });
    return () => AudioEngine.stopLoop('clock');
  }, []);
  return null;
}

/* ------------------------------------------------------------------ */
/* Vent grates                                                         */
/* ------------------------------------------------------------------ */

function VentGrate({
  ventId,
  x,
  z,
  rotY,
  floor,
}: {
  ventId: string;
  x: number;
  z: number;
  rotY: number;
  floor: 'ground' | 'basement';
}) {
  const [open, setOpen] = useState(false);
  const angle = useRef(0);
  const y = FLOOR_Y[floor];
  const pos = useMemo(() => new THREE.Vector3(x, y + 0.45, z), [x, y, z]);
  const meshRef = useRef<THREE.Group>(null);

  useEffect(() => {
    return registerInteractable({
      id: `vent_${ventId}_${x}_${z}`,
      pos,
      radius: 1.4,
      prompt: () => (open ? 'Crawl through (crouch)' : 'Open the vent grate'),
      action: () => {
        if (!open) {
          setOpen(true);
          AudioEngine.play3d('pipe_clank', pos, { volume: 0.7 });
          emitNoise(pos.x, pos.y, pos.z, 0.35, 'impact');
        }
      },
    });
  }, [pos, open, ventId, x, z]);

  useFrame((_, dt) => {
    angle.current = damp(angle.current, open ? 1.5 : 0, 6, Math.min(dt, 0.05));
    if (meshRef.current) meshRef.current.rotation.x = -angle.current;
  });

  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <group ref={meshRef} position={[0, 0.02, 0]}>
        <mesh position={[0, 0.42, 0]} castShadow material={MAT.metalDark()}>
          <boxGeometry args={[0.66, 0.84, 0.03]} />
        </mesh>
        {[-0.2, 0, 0.2].map((oy) => (
          <mesh key={oy} position={[0, 0.42 + oy, -0.02]} material={MAT.metal()}>
            <boxGeometry args={[0.6, 0.05, 0.01]} />
          </mesh>
        ))}
      </group>
      {!open && (
        <RigidBody type="fixed" colliders={false} userData={{ kind: 'furniture' }}>
          <CuboidCollider args={[0.33, 0.42, 0.03]} position={[0, 0.44, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

function Vents() {
  return (
    <>
      {VENTS.map((v) => {
        const alongX = Math.abs(v.a[0] - v.b[0]) > Math.abs(v.a[1] - v.b[1]);
        const rot = alongX ? Math.PI / 2 : 0;
        return (
          <group key={v.id}>
            <VentGrate
              ventId={v.id}
              x={v.a[0]}
              z={v.a[1]}
              rotY={rot}
              floor={v.floor as 'ground' | 'basement'}
            />
            <VentGrate
              ventId={v.id}
              x={v.b[0]}
              z={v.b[1]}
              rotY={rot}
              floor={v.floor as 'ground' | 'basement'}
            />
          </group>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function Furniture() {
  const containers = useMemo(
    () => FURNITURE.filter((f) => spawnByContainer.has(f.id) && f.id !== 'gar_car'),
    []
  );
  const hideables = useMemo(
    () => FURNITURE.filter((f) => HIDE_SPOTS.some((h) => h.id === f.id)),
    []
  );

  return (
    <group>
      <FurnitureStatic />
      {containers.map((f) => (
        <Container key={f.id} f={f} />
      ))}
      {hideables.map((f) => (
        <HideableFurniture key={f.id} f={f} />
      ))}
      {/* car glovebox is a container on a special entity */}
      <Container f={FURNITURE.find((x) => x.id === 'gar_car')!} />
      <StudySafe />
      <SecretBookcase />
      <SecretShelf />
      <FusePanel />
      <Generator />
      <BoilerAmbience />
      <EstateCar />
      <CellarHatch />
      <AtticLadder />
      <RadioLure />
      <PianoEntity />
      <ClockAmbience />
      <Vents />
    </group>
  );
}

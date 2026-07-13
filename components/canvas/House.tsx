'use client';

/**
 * The static structure of Hollowmoor House: every wall segment, floor slab,
 * ceiling, staircase, the pitched roof, porch and garage roof — generated
 * from the declarative level data, merged into a handful of draw calls,
 * with a single fixed rigid body carrying all colliders.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { ALL_WALL_BOXES, floorSlabs, EXTERIOR, STAIRS } from '@/game/levels/layout';
import { FLOOR_Y, FloorId, WallMat, FloorMat } from '@/game/types';
import { BoxSpec, mergeBoxes } from '@/game/graphics/geometry';
import { floorMaterial, wallMaterial, MAT } from '@/game/graphics/materials';

interface ColliderSpec {
  pos: [number, number, number];
  half: [number, number, number];
  rot?: [number, number, number];
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  key: string;
}

interface HouseData {
  batches: Batch[];
  colliders: ColliderSpec[];
  roofGeos: THREE.BufferGeometry[];
}

function useHouseData(): HouseData {
  return useMemo<HouseData>(() => {
    const wallGroups = new Map<string, BoxSpec[]>();
    const colliders: ColliderSpec[] = [];
    const batches: Batch[] = [];

    /* ---- walls ---- */
    for (const b of ALL_WALL_BOXES) {
      const key = `wall_${b.mat}`;
      const list = wallGroups.get(key) ?? [];
      list.push({
        x: b.cx,
        y: b.cy,
        z: b.cz,
        w: b.len,
        h: b.height,
        d: b.thick,
        rotY: b.rotY,
        uvScale: 0.45,
      });
      wallGroups.set(key, list);
      colliders.push({
        pos: [b.cx, b.cy, b.cz],
        half: [b.len / 2, b.height / 2, b.thick / 2],
        rot: [0, b.rotY, 0],
      });
    }
    for (const [key, specs] of wallGroups) {
      const geometry = mergeBoxes(specs);
      if (geometry) {
        batches.push({ geometry, material: wallMaterial(key.slice(5) as WallMat), key });
      }
    }

    /* ---- floor slabs (each also the ceiling of the storey below) ---- */
    const slabGroups = new Map<string, BoxSpec[]>();
    const slabT = 0.24;
    const floors: FloorId[] = ['basement', 'ground', 'upper', 'attic'];
    for (const floor of floors) {
      for (const s of floorSlabs(floor)) {
        const [x0, z0, x1, z1] = s.rect;
        const spec: BoxSpec = {
          x: (x0 + x1) / 2,
          y: FLOOR_Y[floor] - slabT / 2,
          z: (z0 + z1) / 2,
          w: x1 - x0,
          h: slabT,
          d: z1 - z0,
          uvScale: 0.5,
        };
        const key = `floor_${s.mat}`;
        const list = slabGroups.get(key) ?? [];
        list.push(spec);
        slabGroups.set(key, list);
        colliders.push({
          pos: [spec.x, spec.y, spec.z],
          half: [spec.w / 2, slabT / 2, spec.d / 2],
        });
      }
    }
    // Ceiling bands over the upper floor outside the attic footprint.
    const ceilBands: [number, number, number, number][] = [
      [-10, -8, -8, 8],
      [2, -8, 4, 8],
      [-8, -8, 2, -6],
      [-8, 6, 2, 8],
    ];
    for (const [x0, z0, x1, z1] of ceilBands) {
      const spec: BoxSpec = {
        x: (x0 + x1) / 2,
        y: FLOOR_Y.attic - slabT / 2,
        z: (z0 + z1) / 2,
        w: x1 - x0,
        h: slabT,
        d: z1 - z0,
        uvScale: 0.5,
      };
      const list = slabGroups.get('floor_darkwood') ?? [];
      list.push(spec);
      slabGroups.set('floor_darkwood', list);
      colliders.push({ pos: [spec.x, spec.y, spec.z], half: [spec.w / 2, slabT / 2, spec.d / 2] });
    }
    // Garage flat roof (walkable) + parapet.
    const gr = EXTERIOR.garageRoof;
    {
      const spec: BoxSpec = {
        x: (gr.x0 + gr.x1) / 2,
        y: gr.y - slabT / 2,
        z: (gr.z0 + gr.z1) / 2,
        w: gr.x1 - gr.x0,
        h: slabT,
        d: gr.z1 - gr.z0,
        uvScale: 0.5,
      };
      const list = slabGroups.get('floor_concrete') ?? [];
      list.push(spec);
      // Parapet on the three exposed sides.
      const p = gr.parapet;
      const pt = 0.14;
      const parapets: BoxSpec[] = [
        {
          x: (gr.x0 + gr.x1) / 2,
          y: gr.y + p / 2,
          z: gr.z0 + pt / 2,
          w: gr.x1 - gr.x0,
          h: p,
          d: pt,
        },
        {
          x: (gr.x0 + gr.x1) / 2,
          y: gr.y + p / 2,
          z: gr.z1 - pt / 2,
          w: gr.x1 - gr.x0,
          h: p,
          d: pt,
        },
        {
          x: gr.x1 - pt / 2,
          y: gr.y + p / 2,
          z: (gr.z0 + gr.z1) / 2,
          w: pt,
          h: p,
          d: gr.z1 - gr.z0,
        },
      ];
      for (const pp of parapets) {
        list.push({ ...pp, uvScale: 0.5 });
        colliders.push({ pos: [pp.x, pp.y, pp.z], half: [pp.w / 2, pp.h / 2, pp.d / 2] });
      }
      slabGroups.set('floor_concrete', list);
      colliders.push({ pos: [spec.x, spec.y, spec.z], half: [spec.w / 2, slabT / 2, spec.d / 2] });
    }
    for (const [key, specs] of slabGroups) {
      const geometry = mergeBoxes(specs);
      if (geometry) {
        batches.push({ geometry, material: floorMaterial(key.slice(6) as FloorMat), key });
      }
    }

    /* ---- staircases ---- */
    const stepSpecs: BoxSpec[] = [];
    for (const st of STAIRS) {
      const rise = FLOOR_Y[st.upper] - FLOOR_Y[st.lower];
      const fz = -Math.sin(st.dir); // flights run along Z in this house
      const steps = Math.max(10, Math.round(rise / 0.19));
      const stepRise = rise / steps;
      const stepRun = st.length / steps;
      for (let i = 0; i < steps; i++) {
        stepSpecs.push({
          x: st.base[0],
          y: FLOOR_Y[st.lower] + i * stepRise + stepRise / 2,
          z: st.base[1] + fz * (i * stepRun + stepRun / 2),
          w: st.width,
          h: stepRise,
          d: stepRun + 0.04,
          uvScale: 0.6,
        });
      }
      // Smooth ramp collider (kind to the character controller).
      const theta = Math.atan2(rise, st.length);
      const rampLen = Math.hypot(rise, st.length);
      colliders.push({
        pos: [st.base[0], FLOOR_Y[st.lower] + rise / 2 - 0.06, st.base[1] + fz * (st.length / 2)],
        half: [st.width / 2, 0.08, rampLen / 2],
        rot: [Math.sin(st.dir) * theta, 0, 0],
      });
      // Side stringer so you can't slip off the open side of the main flight.
      if (st.id === 'stair_main') {
        const railZ0 = st.base[1];
        const railZ1 = st.base[1] + fz * st.length;
        stepSpecs.push({
          x: st.base[0] - st.width / 2 - 0.04,
          y: FLOOR_Y[st.lower] + rise / 2 + 0.45,
          z: (railZ0 + railZ1) / 2,
          w: 0.07,
          h: 1.0,
          d: Math.abs(railZ1 - railZ0),
          rotY: 0,
          uvScale: 0.6,
        });
        colliders.push({
          pos: [
            st.base[0] - st.width / 2 - 0.04,
            FLOOR_Y[st.lower] + rise / 2 + 0.5,
            (railZ0 + railZ1) / 2,
          ],
          half: [0.05, rise / 2 + 0.55, Math.abs(railZ1 - railZ0) / 2],
        });
      }
    }
    // Upstairs stairwell void railings (west edge + south edge).
    const railSpecs: BoxSpec[] = [
      { x: 1.9, y: FLOOR_Y.upper + 0.45, z: 3.55, w: 0.07, h: 0.9, d: 4.3, uvScale: 0.6 },
      { x: 2.95, y: FLOOR_Y.upper + 0.45, z: 5.7, w: 2.1, h: 0.9, d: 0.07, uvScale: 0.6 },
    ];
    for (const r of railSpecs) {
      stepSpecs.push(r);
      colliders.push({ pos: [r.x, r.y, r.z], half: [r.w / 2, r.h / 2, r.d / 2] });
    }
    const stepGeo = mergeBoxes(stepSpecs);
    if (stepGeo)
      batches.push({ geometry: stepGeo, material: floorMaterial('darkwood'), key: 'stairs' });

    /* ---- pitched roof + chimney + porch ---- */
    const roofGeos: THREE.BufferGeometry[] = [];
    const roofSpecs: BoxSpec[] = [];
    const ridgeX = -3;
    const eaveY = FLOOR_Y.attic + 0.05;
    const ridgeY = eaveY + 2.35;
    // West plane: from x=-10.6 up to ridge; East plane: from x=4.6 to ridge.
    const westW = Math.hypot(ridgeX - -10.6, ridgeY - eaveY);
    const eastW = Math.hypot(4.6 - ridgeX, ridgeY - eaveY);
    const westAng = Math.atan2(ridgeY - eaveY, ridgeX - -10.6);
    const eastAng = Math.atan2(ridgeY - eaveY, 4.6 - ridgeX);
    roofSpecs.push({
      x: (-10.6 + ridgeX) / 2,
      y: (eaveY + ridgeY) / 2,
      z: 0,
      w: westW,
      h: 0.12,
      d: 17.6,
      rotY: 0,
      uvScale: 0.4,
    });
    roofSpecs.push({
      x: (4.6 + ridgeX) / 2,
      y: (eaveY + ridgeY) / 2,
      z: 0,
      w: eastW,
      h: 0.12,
      d: 17.6,
      rotY: 0,
      uvScale: 0.4,
    });
    // Chimney.
    roofSpecs.push({ x: -8.2, y: ridgeY - 0.2, z: -5.4, w: 0.9, h: 2.6, d: 0.9, uvScale: 0.6 });

    // Porch: deck, roof slab, posts, steps.
    const porch = EXTERIOR.porch;
    const porchSpecs: BoxSpec[] = [
      {
        x: (porch.x0 + porch.x1) / 2,
        y: 0.05,
        z: (porch.z0 + porch.z1) / 2,
        w: porch.x1 - porch.x0,
        h: 0.12,
        d: porch.z1 - porch.z0,
        uvScale: 0.5,
      },
      {
        x: (porch.x0 + porch.x1) / 2,
        y: 2.62,
        z: (porch.z0 + porch.z1) / 2 + 0.1,
        w: porch.x1 - porch.x0 + 0.4,
        h: 0.1,
        d: porch.z1 - porch.z0 + 0.5,
        uvScale: 0.5,
      },
      { x: porch.x0 + 0.2, y: 1.3, z: porch.z1 - 0.25, w: 0.14, h: 2.6, d: 0.14 },
      { x: porch.x1 - 0.2, y: 1.3, z: porch.z1 - 0.25, w: 0.14, h: 2.6, d: 0.14 },
    ];
    for (const p of porchSpecs) {
      colliders.push({ pos: [p.x, p.y, p.z], half: [p.w / 2, p.h / 2, p.d / 2] });
    }
    const porchGeo = mergeBoxes(porchSpecs);
    if (porchGeo)
      batches.push({ geometry: porchGeo, material: floorMaterial('darkwood'), key: 'porch' });

    // Roof planes need a Z-roll; build them as individual geometries.
    {
      const mk = (spec: BoxSpec, rotZ: number) => {
        const g = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
        g.rotateZ(rotZ);
        g.translate(spec.x, spec.y, spec.z);
        return g;
      };
      roofGeos.push(mk(roofSpecs[0], westAng));
      roofGeos.push(mk(roofSpecs[1], -eastAng));
      const chim = new THREE.BoxGeometry(0.9, 2.6, 0.9);
      chim.translate(-8.2, ridgeY - 0.2, -5.4);
      roofGeos.push(chim);
      // Gable end caps.
      for (const zEnd of [-8.75, 8.75]) {
        const shape = new THREE.Shape();
        shape.moveTo(-10.6, eaveY);
        shape.lineTo(4.6, eaveY);
        shape.lineTo(ridgeX, ridgeY);
        shape.closePath();
        const cap = new THREE.ShapeGeometry(shape);
        cap.translate(0, 0, zEnd);
        roofGeos.push(cap);
      }
      colliders.push({
        pos: [roofSpecs[0].x, roofSpecs[0].y, 0],
        half: [westW / 2, 0.06, 8.8],
        rot: [0, 0, westAng],
      });
      colliders.push({
        pos: [roofSpecs[1].x, roofSpecs[1].y, 0],
        half: [eastW / 2, 0.06, 8.8],
        rot: [0, 0, -eastAng],
      });
    }

    return { batches, colliders, roofGeos };
  }, []);
}

export default function House() {
  const data = useHouseData();

  return (
    <group>
      {data.batches.map((b) => (
        <mesh key={b.key} geometry={b.geometry} material={b.material} castShadow receiveShadow />
      ))}
      {data.roofGeos.map((g, i) => (
        <mesh key={`roof${i}`} geometry={g} material={MAT.roof()} castShadow />
      ))}
      <RigidBody type="fixed" colliders={false} userData={{ kind: 'house' }}>
        {data.colliders.map((c, i) => (
          <CuboidCollider key={i} args={c.half} position={c.pos} rotation={c.rot ?? [0, 0, 0]} />
        ))}
      </RigidBody>
    </group>
  );
}

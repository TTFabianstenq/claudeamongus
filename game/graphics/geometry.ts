/**
 * Static geometry batching. The house is hundreds of boxes (wall segments,
 * lintels, floor slabs, furniture shells); rendering each as its own mesh
 * would drown the GPU in draw calls. Instead we bake boxes into one merged
 * BufferGeometry per material, with UVs scaled in world units so textures
 * tile correctly across differently-sized boxes.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BoxSpec {
  /** Centre position. */
  x: number;
  y: number;
  z: number;
  /** Full extents. */
  w: number;
  h: number;
  d: number;
  rotY?: number;
  /** UV scale (texture repeats per metre). */
  uvScale?: number;
}

/** Build a box with world-unit UVs (so 1 texture repeat ≈ `1/uvScale` m). */
export function worldUvBox(spec: BoxSpec): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const s = spec.uvScale ?? 0.5;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const faceDims: [number, number][] = [
    [spec.d, spec.h],
    [spec.d, spec.h],
    [spec.w, spec.d],
    [spec.w, spec.d],
    [spec.w, spec.h],
    [spec.w, spec.h],
  ];
  for (let face = 0; face < 6; face++) {
    const [du, dv] = faceDims[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * du * s, uv.getY(i) * dv * s);
    }
  }
  if (spec.rotY) geo.rotateY(spec.rotY);
  geo.translate(spec.x, spec.y, spec.z);
  return geo;
}

/** Merge many boxes into a single geometry (one draw call per material). */
export function mergeBoxes(specs: BoxSpec[]): THREE.BufferGeometry | null {
  if (specs.length === 0) return null;
  const geos = specs.map(worldUvBox);
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

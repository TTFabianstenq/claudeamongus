/**
 * Shared material library. Materials are cached singletons so merged static
 * geometry batches by material — the whole house renders in a handful of
 * draw calls.
 */

import * as THREE from 'three';
import { FloorMat, WallMat } from '@/game/types';
import {
  asphaltTexture,
  barkTexture,
  bookSpinesTexture,
  brickTexture,
  carpetTexture,
  concreteTexture,
  curtainTexture,
  fabricTexture,
  grassTexture,
  metalTexture,
  plankTexture,
  plasterTexture,
  tileTexture,
  wainscotTexture,
  wallpaperTexture,
  woodFloorTexture,
} from '@/game/graphics/textures';

const cache = new Map<string, THREE.Material>();

function std(key: string, make: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const m = make();
  m.name = key;
  cache.set(key, m);
  return m;
}

export function wallMaterial(mat: WallMat): THREE.MeshStandardMaterial {
  switch (mat) {
    case 'wallpaper':
      return std(
        'wall_wallpaper',
        () => new THREE.MeshStandardMaterial({ map: wallpaperTexture(), roughness: 0.92 })
      );
    case 'wainscot':
      return std(
        'wall_wainscot',
        () => new THREE.MeshStandardMaterial({ map: wainscotTexture(), roughness: 0.85 })
      );
    case 'brick':
      return std(
        'wall_brick',
        () => new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 })
      );
    case 'concrete':
      return std(
        'wall_concrete',
        () => new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.97 })
      );
    case 'planks':
      return std(
        'wall_planks',
        () => new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.9 })
      );
    case 'plaster':
    default:
      return std(
        'wall_plaster',
        () => new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.94 })
      );
  }
}

export function floorMaterial(mat: FloorMat): THREE.MeshStandardMaterial {
  switch (mat) {
    case 'wood':
      return std(
        'floor_wood',
        () =>
          new THREE.MeshStandardMaterial({
            map: woodFloorTexture(),
            roughness: 0.72,
            metalness: 0.04,
          })
      );
    case 'darkwood':
      return std(
        'floor_darkwood',
        () =>
          new THREE.MeshStandardMaterial({
            map: woodFloorTexture(true),
            roughness: 0.68,
            metalness: 0.04,
          })
      );
    case 'tile':
      return std(
        'floor_tile',
        () =>
          new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.42, metalness: 0.06 })
      );
    case 'concrete':
      return std(
        'floor_concrete',
        () => new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.96 })
      );
    case 'carpet':
      return std(
        'floor_carpet',
        () => new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 })
      );
    case 'grass':
      return std(
        'floor_grass',
        () => new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 })
      );
    case 'asphalt':
      return std(
        'floor_asphalt',
        () =>
          new THREE.MeshStandardMaterial({
            map: asphaltTexture(),
            roughness: 0.55,
            metalness: 0.05,
          })
      );
  }
}

/* Named extras used by furniture, props and structures ------------- */

export const MAT = {
  trim: () =>
    std('trim', () => new THREE.MeshStandardMaterial({ color: '#2e2018', roughness: 0.8 })),
  darkWood: () =>
    std(
      'darkWoodFurn',
      () => new THREE.MeshStandardMaterial({ map: woodFloorTexture(true), roughness: 0.75 })
    ),
  midWood: () =>
    std(
      'midWoodFurn',
      () => new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.82 })
    ),
  metal: () =>
    std(
      'metalProp',
      () =>
        new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: 0.45, metalness: 0.75 })
    ),
  metalDark: () =>
    std(
      'metalDark',
      () => new THREE.MeshStandardMaterial({ color: '#23262a', roughness: 0.5, metalness: 0.7 })
    ),
  fabric: () =>
    std('fabric', () => new THREE.MeshStandardMaterial({ map: fabricTexture(), roughness: 1 })),
  mattress: () =>
    std('mattress', () => new THREE.MeshStandardMaterial({ color: '#6e675a', roughness: 1 })),
  porcelain: () =>
    std(
      'porcelain',
      () => new THREE.MeshStandardMaterial({ color: '#c9c7be', roughness: 0.25, metalness: 0.02 })
    ),
  books: () =>
    std(
      'books',
      () => new THREE.MeshStandardMaterial({ map: bookSpinesTexture(), roughness: 0.9 })
    ),
  curtain: () =>
    std(
      'curtain',
      () =>
        new THREE.MeshStandardMaterial({
          map: curtainTexture(),
          roughness: 1,
          side: THREE.DoubleSide,
        })
    ),
  bark: () =>
    std('bark', () => new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1 })),
  foliage: () =>
    std(
      'foliage',
      () => new THREE.MeshStandardMaterial({ color: '#16211a', roughness: 1, flatShading: true })
    ),
  glass: () =>
    std('glass', () => {
      const m = new THREE.MeshStandardMaterial({
        color: '#8fa4b0',
        roughness: 0.08,
        metalness: 0.4,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      return m;
    }),
  mirror: () =>
    std(
      'mirror',
      () => new THREE.MeshStandardMaterial({ color: '#aeb6bd', roughness: 0.05, metalness: 0.95 })
    ),
  paper: () =>
    std(
      'paper',
      () =>
        new THREE.MeshStandardMaterial({ color: '#c9bfa4', roughness: 0.9, side: THREE.DoubleSide })
    ),
  bulbOff: () =>
    std('bulbOff', () => new THREE.MeshStandardMaterial({ color: '#3a3730', roughness: 0.4 })),
  carPaint: () =>
    std(
      'carPaint',
      () => new THREE.MeshStandardMaterial({ color: '#3d4a41', roughness: 0.32, metalness: 0.55 })
    ),
  tyre: () =>
    std('tyre', () => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.95 })),
  keeperSkin: () =>
    std('keeperSkin', () => new THREE.MeshStandardMaterial({ color: '#787068', roughness: 0.85 })),
  keeperCoat: () =>
    std('keeperCoat', () => new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.98 })),
  roof: () =>
    std('roof', () => new THREE.MeshStandardMaterial({ color: '#26242a', roughness: 0.9 })),
  stone: () =>
    std(
      'stone',
      () =>
        new THREE.MeshStandardMaterial({
          map: concreteTexture(),
          color: '#8b8d90',
          roughness: 0.95,
        })
    ),
  dirt: () => std('dirt', () => new THREE.MeshStandardMaterial({ color: '#26201a', roughness: 1 })),
};

/** Emissive bulb material per fixture — cloned so intensity can animate. */
export function makeBulbMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#332f28',
    emissive: new THREE.Color(color),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
}

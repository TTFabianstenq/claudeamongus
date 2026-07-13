'use client';

/**
 * Dust motes drifting around the camera; they catch and glow inside the
 * flashlight cone (the shader receives the beam origin/direction).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { makeDustGeometry, makeDustMaterial } from '@/game/graphics/shaders';
import { qualityConfig } from '@/game/state/settingsStore';
import { RT } from '@/game/state/runtime';

export default function Particles() {
  const quality = qualityConfig();
  const geo = useMemo(() => makeDustGeometry(quality.dustCount), [quality.dustCount]);
  const mat = useMemo(() => makeDustMaterial(), []);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    (mat.uniforms.uCam.value as THREE.Vector3).copy(state.camera.position);
    (mat.uniforms.uLightPos.value as THREE.Vector3).copy(state.camera.position);
    (mat.uniforms.uLightDir.value as THREE.Vector3).copy(RT.player.flashlightDir);
    mat.uniforms.uLightOn.value = RT.player.flashlightOn ? 1 : 0;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={55} />;
}

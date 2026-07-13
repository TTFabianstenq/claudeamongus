'use client';

/**
 * Cinematic post-processing chain: N8AO ambient occlusion, bloom for lamps
 * and lightning, film grain, chromatic aberration and a vignette that
 * tightens with dread and injury, ACES tone mapping and SMAA.
 *
 * The vignette/chroma effects are constructed imperatively and mounted as
 * primitives: @react-three/postprocessing memoises wrapped effects with
 * JSON.stringify(props), and under React 19 a `ref` prop would drag the
 * live (circular) effect instance into that stringify.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  N8AO,
  Noise,
  SMAA,
  ToneMapping,
} from '@react-three/postprocessing';
import {
  BlendFunction,
  ChromaticAberrationEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { qualityConfig } from '@/game/state/settingsStore';
import { useGame } from '@/game/state/gameStore';
import { useHud } from '@/game/state/hudStore';
import { damp } from '@/game/utils/math';

export default function PostFX() {
  const quality = qualityConfig();
  const dreadSmooth = useRef(0);

  const vignette = useMemo(
    () => new VignetteEffect({ eskil: false, offset: 0.28, darkness: 0.62 }),
    []
  );
  const chroma = useMemo(
    () =>
      new ChromaticAberrationEffect({
        blendFunction: BlendFunction.NORMAL,
        offset: new THREE.Vector2(0.0006, 0.0004),
        radialModulation: true,
        modulationOffset: 0.4,
      }),
    []
  );

  useFrame((_, dt) => {
    const dread = useHud.getState().dread;
    const health = useGame.getState().health / 100;
    dreadSmooth.current = damp(dreadSmooth.current, dread, 2, Math.min(dt, 0.05));
    const hurt = 1 - health;
    vignette.darkness = 0.62 + dreadSmooth.current * 0.25 + hurt * 0.2;
    vignette.offset = 0.28 - dreadSmooth.current * 0.08;
    const k = 0.0006 + dreadSmooth.current * 0.0022 + hurt * 0.001;
    chroma.offset.set(k, k * 0.6);
  });

  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      {quality.ssao ? (
        <N8AO
          aoRadius={0.9}
          intensity={2.6}
          distanceFalloff={0.6}
          quality={quality.dprMax > 1 ? 'medium' : 'low'}
          halfRes
        />
      ) : (
        <></>
      )}
      {quality.bloom ? (
        <Bloom intensity={0.42} luminanceThreshold={0.72} luminanceSmoothing={0.2} mipmapBlur />
      ) : (
        <></>
      )}
      <primitive object={chroma} />
      <Noise premultiply opacity={0.55} />
      <primitive object={vignette} />
      <BrightnessContrast brightness={-0.015} contrast={0.06} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {quality.smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

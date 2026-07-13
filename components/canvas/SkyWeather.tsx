'use client';

/**
 * The storm: custom shader sky dome with rolling cloud layers and a moon,
 * GPU rain that wraps around the camera, a lightning/thunder scheduler
 * (flash first, delayed rumble by distance, noise-masking for stealth),
 * gusting wind that drives vegetation sway and audio, and exponential fog.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RT, emitNoise } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import {
  makeRainGeometry,
  makeRainMaterial,
  makeSkyMaterial,
  windTimeUniform,
  windUniform,
} from '@/game/graphics/shaders';
import { qualityConfig } from '@/game/state/settingsStore';
import { isOutside } from '@/game/levels/layout';
import { worldActive } from '@/game/state/gameStore';

export default function SkyWeather() {
  const quality = qualityConfig();
  const scene = useThree((s) => s.scene);
  const skyMat = useMemo(() => makeSkyMaterial(), []);
  const rainMat = useMemo(() => makeRainMaterial(), []);
  const rainGeo = useMemo(() => makeRainGeometry(quality.rainCount), [quality.rainCount]);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const flashRef = useRef<THREE.DirectionalLight>(null);

  const nextStrike = useRef(8 + Math.random() * 14);
  const flashSeq = useRef<{ t: number; peaks: number[]; dist: number } | null>(null);
  const thunderQueue = useRef<{ at: number; volume: number } | null>(null);
  const weatherPhase = useRef(Math.random() * 100);

  // Fog — the whole scene breathes it.
  useEffect(() => {
    const fog = new THREE.FogExp2('#06070b', RT.weather.fogDensity);
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    const w = RT.weather;

    /* --- dynamic weather drift --- */
    weatherPhase.current += dt * 0.02;
    const drift = Math.sin(weatherPhase.current) * 0.5 + Math.sin(weatherPhase.current * 2.7) * 0.3;
    w.rain = THREE.MathUtils.clamp(0.55 + drift * 0.45, 0.08, 1);
    const gust = Math.max(0, Math.sin(t * 0.23) * 0.5 + Math.sin(t * 0.071) * 0.5);
    w.wind = THREE.MathUtils.clamp(0.25 + gust * 0.55 + w.rain * 0.2, 0, 1);

    windUniform.value = w.wind;
    windTimeUniform.value = t;

    /* --- sky --- */
    skyMat.uniforms.uTime.value = t;
    skyMat.uniforms.uWind.value = w.wind;
    skyMat.uniforms.uLightning.value = w.lightning;

    /* --- rain --- */
    rainMat.uniforms.uTime.value = t;
    rainMat.uniforms.uIntensity.value = w.rain;
    rainMat.uniforms.uWind.value = (w.wind - 0.3) * 0.6;
    (rainMat.uniforms.uCam.value as THREE.Vector3).copy(state.camera.position);

    /* --- lightning & thunder --- */
    w.lightning = Math.max(0, w.lightning - dt * 3.2);
    w.thunderMask = Math.max(0, w.thunderMask - dt * 0.4);

    if (flashSeq.current) {
      const seq = flashSeq.current;
      seq.t += dt;
      for (const peak of seq.peaks) {
        if (seq.t > peak && seq.t < peak + 0.09) w.lightning = Math.max(w.lightning, 1);
      }
      if (seq.t > seq.peaks[seq.peaks.length - 1] + 0.4) {
        thunderQueue.current = {
          at: t + seq.dist * 0.55,
          volume: THREE.MathUtils.clamp(1.15 - seq.dist * 0.14, 0.3, 1.1),
        };
        flashSeq.current = null;
      }
    } else {
      nextStrike.current -= dt * (0.6 + w.rain);
      if (nextStrike.current <= 0) {
        nextStrike.current = 9 + Math.random() * 22;
        flashSeq.current = {
          t: 0,
          peaks: Math.random() < 0.5 ? [0, 0.18] : [0, 0.14, 0.42],
          dist: 1 + Math.random() * 6, // km-ish → seconds of delay
        };
      }
    }
    if (thunderQueue.current && t >= thunderQueue.current.at) {
      const { volume } = thunderQueue.current;
      thunderQueue.current = null;
      AudioEngine.play('thunder', { volume, rate: 0.85 + Math.random() * 0.3 });
      w.thunderMask = Math.min(1, 0.5 + volume * 0.5);
      RT.shake = Math.min(1, RT.shake + volume * 0.25);
      if (worldActive()) {
        // Thunder itself is a noise event — it draws the Keeper outdoors
        // occasionally, and masks the player's own sounds.
        emitNoise(
          RT.player.pos.x + (Math.random() - 0.5) * 30,
          2,
          RT.player.pos.z - 30,
          0.15,
          'machine',
          false
        );
      }
    }
    if (flashRef.current) flashRef.current.intensity = w.lightning * 3.2;

    /* --- weather audio --- */
    const p = RT.player;
    const outside = isOutside(p.pos.x, p.pos.z) || p.onRoof;
    const inBasement = p.floor === 'basement';
    AudioEngine.setLoop('rain_out', 'rain_out', outside ? w.rain : w.rain * 0.18, {
      bus: 'ambience',
    });
    AudioEngine.setLoop(
      'rain_in',
      'rain_in',
      outside ? 0 : inBasement ? w.rain * 0.12 : w.rain * 0.55,
      { bus: 'ambience' }
    );
    AudioEngine.setLoop('wind', 'wind', (outside ? 1 : 0.35) * w.wind * 0.9, { bus: 'ambience' });
  });

  return (
    <group>
      <mesh material={skyMat} frustumCulled={false} renderOrder={-100}>
        <sphereGeometry args={[240, 24, 16]} />
      </mesh>
      {/* Moon — cold key light. */}
      <directionalLight
        ref={moonRef}
        position={[-45, 65, -75]}
        intensity={0.34}
        color="#7d8ba8"
        castShadow={quality.moonShadow}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-far={200}
        shadow-bias={-0.0012}
      />
      {/* Lightning fill. */}
      <directionalLight ref={flashRef} position={[20, 80, 10]} intensity={0} color="#cdd6ff" />
      {/* Ambient bounce — barely there; the dark is the point. */}
      <hemisphereLight args={['#232a3a', '#0a0908', 0.32]} />
      <points geometry={rainGeo} material={rainMat} frustumCulled={false} renderOrder={60} />
    </group>
  );
}

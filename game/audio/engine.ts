/**
 * Playback engine on top of Howler: 3D positional SFX with distance/occlusion
 * attenuation, crossfaded ambience loops, and the adaptive music system
 * (drone ↔ chase layers, heartbeat, stingers).
 */

import { Howl, Howler } from 'howler';
import * as THREE from 'three';
import { synthesizeAll } from '@/game/audio/sounds';
import { useSettings } from '@/game/state/settingsStore';
import { damp, clamp01 } from '@/game/utils/math';

export type SfxOptions = {
  volume?: number;
  rate?: number;
  /** Extra multiplier for occlusion (0..1). */
  occlusion?: number;
  refDistance?: number;
  maxDistance?: number;
};

type LoopChannel = {
  howl: Howl;
  id: number;
  current: number;
  target: number;
  baseVolume: number;
  bus: 'sfx' | 'music' | 'ambience';
  rate: number;
};

class AudioEngineImpl {
  private howls = new Map<string, Howl>();
  private baseVolumes = new Map<string, number>();
  private loops = new Map<string, LoopChannel>();
  ready = false;
  private initPromise: Promise<void> | null = null;

  /** Music state fed by the enemy brain. */
  musicMood = 0; // 0 calm .. 1 chase
  heartbeatRate = 0; // 0 off .. 1 frantic

  async init(onProgress?: (p: number) => void): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const rendered = await synthesizeAll((done, total) => onProgress?.(done / total));
      for (const [name, s] of Object.entries(rendered)) {
        this.howls.set(
          name,
          new Howl({ src: [s.url], format: ['wav'], loop: s.loop, preload: true })
        );
        this.baseVolumes.set(name, s.volume);
      }
      this.ready = true;
    })();
    return this.initPromise;
  }

  unlock(): void {
    // Howler auto-unlocks on gesture; nudge the context anyway.
    const ctx = Howler.ctx as AudioContext | undefined;
    if (ctx && ctx.state !== 'running') void ctx.resume();
  }

  private bus(kind: 'sfx' | 'music' | 'ambience'): number {
    const s = useSettings.getState();
    const master = s.masterVolume;
    if (kind === 'music') return master * s.musicVolume;
    if (kind === 'ambience') return master * s.ambienceVolume;
    return master * s.sfxVolume;
  }

  /** Fire-and-forget UI / non-spatial sound. */
  play(name: string, opts: SfxOptions = {}): void {
    const h = this.howls.get(name);
    if (!h) return;
    const id = h.play();
    h.volume((opts.volume ?? 1) * (this.baseVolumes.get(name) ?? 1) * this.bus('sfx'), id);
    if (opts.rate) h.rate(opts.rate, id);
  }

  /** Positional one-shot. Listener pose comes from update(). */
  play3d(name: string, pos: THREE.Vector3 | [number, number, number], opts: SfxOptions = {}): void {
    const h = this.howls.get(name);
    if (!h) return;
    const [x, y, z] = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z];
    const id = h.play();
    h.volume(
      (opts.volume ?? 1) *
        (opts.occlusion ?? 1) *
        (this.baseVolumes.get(name) ?? 1) *
        this.bus('sfx'),
      id
    );
    if (opts.rate) h.rate(opts.rate, id);
    h.pannerAttr(
      {
        panningModel: 'equalpower',
        distanceModel: 'inverse',
        refDistance: opts.refDistance ?? 1.6,
        maxDistance: opts.maxDistance ?? 60,
        rolloffFactor: 1.1,
        coneInnerAngle: 360,
        coneOuterAngle: 360,
        coneOuterGain: 0,
      },
      id
    );
    h.pos(x, y, z, id);
  }

  /**
   * Persistent loop management. Loops are started muted and crossfaded via
   * setLoop targets; update() eases the volumes every frame.
   */
  setLoop(
    key: string,
    sound: string,
    target: number,
    opts: {
      pos?: THREE.Vector3 | [number, number, number];
      rate?: number;
      bus?: LoopChannel['bus'];
    } = {}
  ): void {
    let ch = this.loops.get(key);
    if (!ch) {
      const howl = this.howls.get(sound);
      if (!howl) return;
      const id = howl.play();
      howl.volume(0, id);
      howl.loop(true, id);
      if (opts.pos) {
        const [x, y, z] = Array.isArray(opts.pos) ? opts.pos : [opts.pos.x, opts.pos.y, opts.pos.z];
        howl.pannerAttr(
          {
            panningModel: 'equalpower',
            distanceModel: 'inverse',
            refDistance: 1.8,
            maxDistance: 45,
            rolloffFactor: 1.1,
            coneInnerAngle: 360,
            coneOuterAngle: 360,
            coneOuterGain: 0,
          },
          id
        );
        howl.pos(x, y, z, id);
      }
      ch = {
        howl,
        id,
        current: 0,
        target,
        baseVolume: this.baseVolumes.get(sound) ?? 1,
        bus: opts.bus ?? 'ambience',
        rate: opts.rate ?? 1,
      };
      this.loops.set(key, ch);
    }
    ch.target = target;
    if (opts.rate && Math.abs(opts.rate - ch.rate) > 0.01) {
      ch.rate = opts.rate;
      ch.howl.rate(opts.rate, ch.id);
    }
    if (opts.pos) {
      const [x, y, z] = Array.isArray(opts.pos) ? opts.pos : [opts.pos.x, opts.pos.y, opts.pos.z];
      ch.howl.pos(x, y, z, ch.id);
    }
  }

  stopLoop(key: string): void {
    const ch = this.loops.get(key);
    if (!ch) return;
    ch.howl.stop(ch.id);
    this.loops.delete(key);
  }

  stopAllLoops(): void {
    for (const key of Array.from(this.loops.keys())) this.stopLoop(key);
  }

  /** Called every frame from the scene with the camera pose. */
  update(dt: number, camPos: THREE.Vector3, camDir: THREE.Vector3): void {
    if (!this.ready) return;
    Howler.pos(camPos.x, camPos.y, camPos.z);
    Howler.orientation(camDir.x, camDir.y, camDir.z, 0, 1, 0);

    for (const ch of this.loops.values()) {
      ch.current = damp(ch.current, ch.target, 3.5, dt);
      ch.howl.volume(clamp01(ch.current) * ch.baseVolume * this.bus(ch.bus), ch.id);
    }
  }

  /** Adaptive score: call with the world's current tension. */
  updateMusic(dt: number, opts: { mood: number; heartbeat: number; inGame: boolean }): void {
    if (!this.ready) return;
    this.musicMood = damp(this.musicMood, opts.mood, 1.2, dt);
    this.setLoop('music_drone', 'drone', opts.inGame ? 0.55 * (1 - this.musicMood * 0.7) : 0, {
      bus: 'music',
    });
    this.setLoop('music_chase', 'chase', opts.inGame ? this.musicMood : 0, { bus: 'music' });

    this.heartbeatRate = damp(this.heartbeatRate, opts.heartbeat, 2, dt);
    const hb = this.heartbeatRate;
    this.setLoop('heartbeat', 'heartbeat', hb > 0.06 ? Math.min(1, hb * 1.1) : 0, {
      bus: 'sfx',
      rate: 0.85 + hb * 0.75,
    });
  }
}

export const AudioEngine = new AudioEngineImpl();

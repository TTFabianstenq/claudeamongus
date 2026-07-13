/**
 * The complete sound design catalogue — every effect, ambience and music
 * layer in the game, described as an OfflineAudioContext build recipe.
 */

import {
  envAHR,
  envPerc,
  filter,
  gain,
  noise,
  osc,
  renderSound,
  shaper,
  tail,
  bufferToWavUrl,
  SoundBuilder,
} from '@/game/audio/synth';

export interface SoundDef {
  dur: number;
  build: SoundBuilder;
  loop?: boolean;
  loopBlend?: number;
  stereo?: boolean;
  volume?: number;
}

/* Small composition helpers ---------------------------------------- */

const thump =
  (t0: number, f0: number, f1: number, dur: number, peak = 1) =>
  (ctx: OfflineAudioContext, out: GainNode) => {
    const o = osc(ctx, 'sine', f0);
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const e = envPerc(ctx, t0, 0.004, dur, peak);
    o.connect(e).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };

const noiseBurst =
  (
    t0: number,
    dur: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    peak: number,
    attack = 0.003
  ) =>
  (ctx: OfflineAudioContext, out: GainNode) => {
    const n = noise(ctx, dur + 0.05);
    const f = filter(ctx, type, freq, q);
    const e = envPerc(ctx, t0, attack, dur, peak);
    n.connect(f).connect(e).connect(out);
    n.start(t0);
  };

/* ------------------------------------------------------------------ */

export const SOUND_DEFS: Record<string, SoundDef> = {
  /* ---- Footsteps (per material) ---- */
  step_wood: {
    dur: 0.22,
    build: (ctx, out) => {
      thump(0, 95, 45, 0.1, 0.7)(ctx, out);
      noiseBurst(0, 0.09, 'bandpass', 900, 1.2, 0.35)(ctx, out);
    },
  },
  step_tile: {
    dur: 0.2,
    build: (ctx, out) => {
      thump(0, 120, 60, 0.07, 0.4)(ctx, out);
      noiseBurst(0, 0.06, 'highpass', 1800, 1, 0.4)(ctx, out);
      const t = tail(ctx, 0.22, 0.05, 0.4, 2400);
      const n = noise(ctx, 0.05);
      const e = envPerc(ctx, 0, 0.002, 0.04, 0.25);
      n.connect(e).connect(t.input as GainNode);
      t.output.connect(out);
      n.start(0);
    },
  },
  step_concrete: {
    dur: 0.2,
    build: (ctx, out) => {
      thump(0, 105, 50, 0.08, 0.55)(ctx, out);
      noiseBurst(0, 0.07, 'bandpass', 1400, 1, 0.35)(ctx, out);
    },
  },
  step_carpet: {
    dur: 0.2,
    build: (ctx, out) => {
      thump(0, 80, 40, 0.09, 0.4)(ctx, out);
      noiseBurst(0, 0.11, 'lowpass', 500, 0.7, 0.3, 0.01)(ctx, out);
    },
  },
  step_grass: {
    dur: 0.26,
    build: (ctx, out) => {
      noiseBurst(0, 0.1, 'bandpass', 700, 0.8, 0.4, 0.008)(ctx, out);
      noiseBurst(0.05, 0.12, 'bandpass', 1100, 0.9, 0.3, 0.01)(ctx, out);
      thump(0, 70, 40, 0.09, 0.35)(ctx, out);
    },
  },
  step_wet: {
    dur: 0.26,
    build: (ctx, out) => {
      thump(0, 90, 45, 0.08, 0.4)(ctx, out);
      noiseBurst(0, 0.14, 'highpass', 2600, 0.8, 0.4, 0.006)(ctx, out);
      noiseBurst(0.04, 0.08, 'bandpass', 4200, 2, 0.2)(ctx, out);
    },
  },
  creak_floor: {
    dur: 0.7,
    volume: 0.7,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 160);
      o.frequency.setValueAtTime(140, 0);
      o.frequency.linearRampToValueAtTime(310, 0.35);
      o.frequency.linearRampToValueAtTime(180, 0.65);
      const f = filter(ctx, 'bandpass', 700, 6);
      const e = envAHR(ctx, 0, 0.12, 0.25, 0.25, 0.16);
      o.connect(f).connect(e).connect(out);
      o.start(0);
      o.stop(0.7);
    },
  },

  /* ---- Doors, drawers, containers ---- */
  door_creak: {
    dur: 1.1,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 90);
      o.frequency.setValueAtTime(70, 0);
      o.frequency.linearRampToValueAtTime(150, 0.5);
      o.frequency.linearRampToValueAtTime(95, 1.0);
      const vib = osc(ctx, 'sine', 9);
      const vibGain = gain(ctx, 22);
      vib.connect(vibGain).connect(o.frequency);
      const f = filter(ctx, 'bandpass', 520, 7);
      const e = envAHR(ctx, 0, 0.15, 0.55, 0.3, 0.2);
      o.connect(f).connect(e).connect(out);
      o.start(0);
      vib.start(0);
      o.stop(1.1);
      vib.stop(1.1);
    },
  },
  door_close: {
    dur: 0.4,
    build: (ctx, out) => {
      thump(0, 130, 45, 0.16, 0.9)(ctx, out);
      noiseBurst(0.01, 0.08, 'bandpass', 800, 1, 0.3)(ctx, out);
      thump(0.05, 65, 35, 0.2, 0.5)(ctx, out);
    },
  },
  door_locked: {
    dur: 0.5,
    build: (ctx, out) => {
      for (const t0 of [0, 0.12, 0.22]) {
        noiseBurst(t0, 0.035, 'bandpass', 2600, 4, 0.5)(ctx, out);
        thump(t0, 220, 120, 0.05, 0.3)(ctx, out);
      }
    },
  },
  door_unlock: {
    dur: 0.5,
    build: (ctx, out) => {
      noiseBurst(0, 0.04, 'bandpass', 3200, 5, 0.4)(ctx, out);
      noiseBurst(0.16, 0.05, 'bandpass', 2100, 4, 0.5)(ctx, out);
      thump(0.18, 300, 150, 0.08, 0.35)(ctx, out);
    },
  },
  door_bang: {
    dur: 0.6,
    build: (ctx, out) => {
      thump(0, 90, 30, 0.35, 1.2)(ctx, out);
      noiseBurst(0, 0.2, 'lowpass', 900, 0.8, 0.8)(ctx, out);
    },
  },
  door_break: {
    dur: 1.0,
    build: (ctx, out) => {
      thump(0, 100, 30, 0.4, 1.2)(ctx, out);
      for (let i = 0; i < 7; i++) {
        noiseBurst(0.02 + i * 0.05, 0.09, 'bandpass', 1000 + i * 500, 3, 0.5 - i * 0.05)(ctx, out);
      }
    },
  },
  drawer: {
    dur: 0.5,
    build: (ctx, out) => {
      noiseBurst(0, 0.3, 'bandpass', 620, 2, 0.28, 0.05)(ctx, out);
      thump(0.32, 140, 70, 0.09, 0.4)(ctx, out);
    },
  },
  wardrobe_door: {
    dur: 0.7,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 110);
      o.frequency.linearRampToValueAtTime(190, 0.4);
      const f = filter(ctx, 'bandpass', 620, 6);
      const e = envAHR(ctx, 0, 0.1, 0.3, 0.2, 0.14);
      o.connect(f).connect(e).connect(out);
      o.start(0);
      o.stop(0.65);
      thump(0.45, 110, 55, 0.12, 0.5)(ctx, out);
    },
  },
  rummage: {
    dur: 0.9,
    build: (ctx, out) => {
      for (let i = 0; i < 6; i++) {
        noiseBurst(i * 0.13, 0.09, 'bandpass', 500 + (i % 3) * 400, 1.5, 0.25)(ctx, out);
      }
    },
  },

  /* ---- Mechanisms ---- */
  switch_click: {
    dur: 0.12,
    build: (ctx, out) => {
      noiseBurst(0, 0.02, 'highpass', 2500, 2, 0.5)(ctx, out);
      thump(0.005, 400, 200, 0.03, 0.3)(ctx, out);
    },
  },
  breaker_on: {
    dur: 0.6,
    build: (ctx, out) => {
      thump(0, 180, 60, 0.2, 0.8)(ctx, out);
      noiseBurst(0.02, 0.1, 'bandpass', 1600, 2, 0.4)(ctx, out);
      const o = osc(ctx, 'sawtooth', 50);
      const e = envAHR(ctx, 0.15, 0.05, 0.2, 0.2, 0.12);
      const f = filter(ctx, 'lowpass', 300);
      o.connect(f).connect(e).connect(out);
      o.start(0.15);
      o.stop(0.6);
    },
  },
  keypad_beep: {
    dur: 0.12,
    build: (ctx, out) => {
      const o = osc(ctx, 'square', 1050);
      const e = envAHR(ctx, 0, 0.005, 0.06, 0.04, 0.12);
      o.connect(e).connect(out);
      o.start(0);
      o.stop(0.12);
    },
  },
  keypad_ok: {
    dur: 0.4,
    build: (ctx, out) => {
      for (const [t0, f] of [
        [0, 880],
        [0.12, 1320],
      ] as const) {
        const o = osc(ctx, 'square', f);
        const e = envAHR(ctx, t0, 0.005, 0.08, 0.06, 0.12);
        o.connect(e).connect(out);
        o.start(t0);
        o.stop(t0 + 0.2);
      }
    },
  },
  keypad_err: {
    dur: 0.5,
    build: (ctx, out) => {
      const o = osc(ctx, 'square', 220);
      const e = envAHR(ctx, 0, 0.005, 0.3, 0.1, 0.14);
      o.connect(e).connect(out);
      o.start(0);
      o.stop(0.5);
    },
  },
  safe_tick: {
    dur: 0.08,
    build: (ctx, out) => {
      noiseBurst(0, 0.015, 'highpass', 3000, 3, 0.35)(ctx, out);
    },
  },
  safe_open: {
    dur: 0.8,
    build: (ctx, out) => {
      noiseBurst(0, 0.05, 'bandpass', 1800, 4, 0.4)(ctx, out);
      thump(0.1, 120, 40, 0.4, 0.9)(ctx, out);
      const o = osc(ctx, 'sawtooth', 60);
      const f = filter(ctx, 'lowpass', 200);
      const e = envAHR(ctx, 0.1, 0.1, 0.2, 0.3, 0.2);
      o.connect(f).connect(e).connect(out);
      o.start(0.1);
      o.stop(0.8);
    },
  },
  pry: {
    dur: 0.9,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 70);
      o.frequency.linearRampToValueAtTime(160, 0.5);
      const f = filter(ctx, 'bandpass', 400, 5);
      const e = envAHR(ctx, 0, 0.2, 0.25, 0.2, 0.25);
      o.connect(f).connect(e).connect(out);
      o.start(0);
      o.stop(0.75);
      thump(0.55, 150, 40, 0.3, 1.0)(ctx, out);
      noiseBurst(0.55, 0.2, 'bandpass', 900, 1, 0.5)(ctx, out);
    },
  },
  chain_cut: {
    dur: 0.9,
    build: (ctx, out) => {
      noiseBurst(0, 0.05, 'highpass', 2400, 2, 0.6)(ctx, out);
      thump(0.05, 500, 200, 0.1, 0.4)(ctx, out);
      // chain links falling
      for (let i = 0; i < 6; i++) {
        noiseBurst(
          0.2 + i * 0.09,
          0.05,
          'bandpass',
          2600 + (i % 3) * 800,
          6,
          0.35 - i * 0.04
        )(ctx, out);
      }
    },
  },
  glass_break: {
    dur: 1.2,
    build: (ctx, out) => {
      noiseBurst(0, 0.12, 'highpass', 3000, 1, 0.9, 0.001)(ctx, out);
      for (let i = 0; i < 12; i++) {
        const f0 = 1600 + ((i * 733) % 3400);
        const o = osc(ctx, 'sine', f0);
        const e = envPerc(ctx, 0.03 + i * 0.05, 0.002, 0.16, 0.16);
        o.connect(e).connect(out);
        o.start(0.03 + i * 0.05);
        o.stop(0.4 + i * 0.05);
      }
    },
  },
  shelf_slide: {
    dur: 1.6,
    build: (ctx, out) => {
      const n = noise(ctx, 1.5);
      const f = filter(ctx, 'lowpass', 260, 1);
      const e = envAHR(ctx, 0, 0.3, 0.7, 0.4, 0.8);
      n.connect(f).connect(e).connect(out);
      n.start(0);
      thump(1.25, 70, 30, 0.3, 0.8)(ctx, out);
    },
  },
  hatch_open: {
    dur: 1.1,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 55);
      o.frequency.linearRampToValueAtTime(110, 0.7);
      const f = filter(ctx, 'bandpass', 330, 4);
      const e = envAHR(ctx, 0, 0.25, 0.4, 0.3, 0.3);
      o.connect(f).connect(e).connect(out);
      o.start(0);
      o.stop(1.0);
      thump(0.8, 90, 35, 0.25, 0.9)(ctx, out);
    },
  },
  generator_start: {
    dur: 2.2,
    build: (ctx, out) => {
      // sputtering pulses that accelerate into a steady chug
      let t = 0.1;
      let interval = 0.3;
      while (t < 1.9) {
        thump(t, 110, 60, 0.08, 0.7)(ctx, out);
        noiseBurst(t, 0.05, 'lowpass', 700, 1, 0.4)(ctx, out);
        interval = Math.max(0.08, interval * 0.82);
        t += interval;
      }
    },
  },
  car_start: {
    dur: 2.4,
    build: (ctx, out) => {
      for (let i = 0; i < 8; i++) {
        noiseBurst(0.05 + i * 0.09, 0.06, 'bandpass', 480, 2, 0.45)(ctx, out);
      }
      const o = osc(ctx, 'sawtooth', 55);
      o.frequency.setValueAtTime(45, 0.9);
      o.frequency.linearRampToValueAtTime(120, 2.2);
      const f = filter(ctx, 'lowpass', 400);
      const e = envAHR(ctx, 0.9, 0.3, 0.8, 0.4, 0.5);
      o.connect(f).connect(e).connect(out);
      o.start(0.9);
      o.stop(2.4);
    },
  },

  /* ---- Weather ---- */
  thunder: {
    dur: 3.6,
    stereo: true,
    build: (ctx, out) => {
      const n = noise(ctx, 3.4);
      const f = filter(ctx, 'lowpass', 420, 0.6);
      f.frequency.setValueAtTime(500, 0);
      f.frequency.exponentialRampToValueAtTime(70, 3.0);
      const e = envAHR(ctx, 0, 0.02, 0.5, 2.6, 1.15);
      const t = tail(ctx, 0.5, 0.16, 0.6, 500);
      n.connect(f)
        .connect(e)
        .connect(t.input as GainNode);
      t.output.connect(out);
      n.start(0);
      const sub = osc(ctx, 'sine', 36);
      const wob = osc(ctx, 'sine', 2.2);
      const wg = gain(ctx, 7);
      wob.connect(wg).connect(sub.frequency);
      const se = envAHR(ctx, 0.05, 0.15, 0.8, 2.2, 0.7);
      sub.connect(se).connect(out);
      sub.start(0.05);
      wob.start(0.05);
      sub.stop(3.4);
      wob.stop(3.4);
    },
  },
  rain_out: {
    dur: 5,
    loop: true,
    loopBlend: 0.6,
    stereo: true,
    build: (ctx, out) => {
      const n = noise(ctx, 6);
      const f = filter(ctx, 'bandpass', 2400, 0.35);
      const g1 = gain(ctx, 0.4);
      n.connect(f).connect(g1).connect(out);
      n.start(0);
      const n2 = noise(ctx, 6);
      const f2 = filter(ctx, 'lowpass', 700, 0.5);
      const g2 = gain(ctx, 0.25);
      n2.connect(f2).connect(g2).connect(out);
      n2.start(0.7);
    },
  },
  rain_in: {
    dur: 5,
    loop: true,
    loopBlend: 0.6,
    stereo: true,
    build: (ctx, out) => {
      const n = noise(ctx, 6);
      const f = filter(ctx, 'lowpass', 380, 0.6);
      const g1 = gain(ctx, 0.5);
      n.connect(f).connect(g1).connect(out);
      n.start(0);
      // occasional drips on the sill
      for (let i = 0; i < 7; i++) {
        thump(0.3 + i * 0.68, 1900 - i * 130, 700, 0.04, 0.05)(ctx, out);
      }
    },
  },
  wind: {
    dur: 7,
    loop: true,
    loopBlend: 0.9,
    stereo: true,
    build: (ctx, out) => {
      const n = noise(ctx, 8);
      const f = filter(ctx, 'bandpass', 500, 1.6);
      const lfo = osc(ctx, 'sine', 0.14);
      const lg = gain(ctx, 260);
      lfo.connect(lg).connect(f.frequency);
      const g1 = gain(ctx, 0.5);
      n.connect(f).connect(g1).connect(out);
      n.start(0);
      lfo.start(0);
    },
  },

  /* ---- Ambience ---- */
  house_creak: {
    dur: 1.4,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 60);
      o.frequency.linearRampToValueAtTime(140, 0.9);
      o.frequency.linearRampToValueAtTime(85, 1.3);
      const f = filter(ctx, 'bandpass', 300, 9);
      const e = envAHR(ctx, 0, 0.4, 0.4, 0.5, 0.12);
      o.connect(f).connect(e).connect(out);
      o.start(0);
      o.stop(1.4);
    },
  },
  pipe_clank: {
    dur: 1.0,
    build: (ctx, out) => {
      for (const [t0, f0] of [
        [0, 620],
        [0.16, 590],
        [0.44, 640],
      ] as const) {
        const o = osc(ctx, 'triangle', f0);
        const e = envPerc(ctx, t0, 0.002, 0.28, 0.2);
        const fl = filter(ctx, 'bandpass', f0, 14);
        o.connect(fl).connect(e).connect(out);
        o.start(t0);
        o.stop(t0 + 0.5);
      }
    },
  },
  buzz: {
    dur: 2,
    loop: true,
    loopBlend: 0.3,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 60);
      const o2 = osc(ctx, 'sawtooth', 120.3);
      const f = filter(ctx, 'bandpass', 900, 3);
      const g1 = gain(ctx, 0.05);
      o.connect(f);
      o2.connect(f);
      f.connect(g1).connect(out);
      o.start(0);
      o2.start(0);
    },
  },
  boiler_loop: {
    dur: 3,
    loop: true,
    loopBlend: 0.5,
    build: (ctx, out) => {
      const n = noise(ctx, 4);
      const f = filter(ctx, 'lowpass', 220, 0.8);
      const g1 = gain(ctx, 0.4);
      n.connect(f).connect(g1).connect(out);
      n.start(0);
      const hiss = noise(ctx, 4);
      const hf = filter(ctx, 'bandpass', 3400, 3);
      const hg = gain(ctx, 0.04);
      hiss.connect(hf).connect(hg).connect(out);
      hiss.start(1.1);
    },
  },
  generator_loop: {
    dur: 2,
    loop: true,
    loopBlend: 0.25,
    build: (ctx, out) => {
      const rate = 9;
      for (let i = 0; i < rate * 2.4; i++) {
        thump(i / rate, 95, 55, 0.06, 0.5)(ctx, out);
      }
      const o = osc(ctx, 'sawtooth', 48);
      const f = filter(ctx, 'lowpass', 220);
      const g1 = gain(ctx, 0.16);
      o.connect(f).connect(g1).connect(out);
      o.start(0);
    },
  },
  clock_tick: {
    dur: 2,
    loop: true,
    build: (ctx, out) => {
      noiseBurst(0.0, 0.02, 'bandpass', 2100, 8, 0.22)(ctx, out);
      noiseBurst(1.0, 0.02, 'bandpass', 1700, 8, 0.18)(ctx, out);
    },
  },
  radio_waltz: {
    dur: 9.6,
    loop: true,
    loopBlend: 0.4,
    volume: 0.8,
    build: (ctx, out) => {
      // A thin, warbling waltz on a dying wireless — original melody.
      const vinyl = noise(ctx, 10);
      const vf = filter(ctx, 'bandpass', 3200, 1);
      const vg = gain(ctx, 0.03);
      vinyl.connect(vf).connect(vg).connect(out);
      vinyl.start(0);
      const melody = [
        392, 494, 587, 494, 523, 440, 392, 330, 349, 440, 523, 494, 440, 392, 330, 294,
      ];
      const beat = 0.6;
      melody.forEach((f0, i) => {
        const t0 = i * beat;
        const o = osc(ctx, 'triangle', f0);
        const warble = osc(ctx, 'sine', 5.5);
        const wg = gain(ctx, 4);
        warble.connect(wg).connect(o.frequency);
        const bp = filter(ctx, 'bandpass', 1100, 2);
        const e = envAHR(ctx, t0, 0.03, beat * 0.5, beat * 0.4, 0.16);
        o.connect(bp).connect(e).connect(out);
        o.start(t0);
        warble.start(t0);
        o.stop(t0 + beat);
        warble.stop(t0 + beat);
        if (i % 4 === 0) {
          const b = osc(ctx, 'triangle', f0 / 4);
          const be = envAHR(ctx, t0, 0.02, beat, beat * 0.6, 0.12);
          b.connect(be).connect(out);
          b.start(t0);
          b.stop(t0 + beat * 2);
        }
      });
    },
  },
  piano_hit: {
    dur: 1.6,
    build: (ctx, out) => {
      for (const f0 of [110, 116.5, 220, 233]) {
        const o = osc(ctx, 'triangle', f0);
        const e = envPerc(ctx, 0, 0.005, 1.3, 0.22);
        o.connect(e).connect(out);
        o.start(0);
        o.stop(1.5);
      }
      noiseBurst(0, 0.03, 'bandpass', 1500, 2, 0.2)(ctx, out);
    },
  },

  /* ---- Player ---- */
  heartbeat: {
    dur: 0.9,
    loop: true,
    volume: 0.9,
    build: (ctx, out) => {
      thump(0, 62, 34, 0.14, 0.9)(ctx, out);
      thump(0.22, 55, 30, 0.12, 0.6)(ctx, out);
    },
  },
  breath_tense: {
    dur: 3.2,
    loop: true,
    loopBlend: 0.4,
    volume: 0.5,
    build: (ctx, out) => {
      for (const [t0, dur] of [
        [0.1, 0.7],
        [1.7, 0.8],
      ] as const) {
        const n = noise(ctx, dur + 0.2);
        const f = filter(ctx, 'bandpass', 900, 1.4);
        const e = envAHR(ctx, t0, dur * 0.5, 0.05, dur * 0.5, 0.12);
        n.connect(f).connect(e).connect(out);
        n.start(t0);
      }
    },
  },
  gasp: {
    dur: 0.6,
    build: (ctx, out) => {
      const n = noise(ctx, 0.6);
      const f = filter(ctx, 'bandpass', 1100, 1.2);
      const e = envAHR(ctx, 0, 0.08, 0.1, 0.35, 0.35);
      n.connect(f).connect(e).connect(out);
      n.start(0);
    },
  },
  hurt: {
    dur: 0.6,
    build: (ctx, out) => {
      thump(0, 140, 50, 0.2, 1.0)(ctx, out);
      const n = noise(ctx, 0.5);
      const f = filter(ctx, 'bandpass', 700, 1);
      const e = envAHR(ctx, 0.02, 0.03, 0.08, 0.3, 0.5);
      n.connect(f).connect(e).connect(out);
      n.start(0.02);
    },
  },
  land_soft: {
    dur: 0.3,
    build: (ctx, out) => {
      thump(0, 100, 40, 0.14, 0.6)(ctx, out);
      noiseBurst(0, 0.08, 'lowpass', 600, 1, 0.3)(ctx, out);
    },
  },
  land_hard: {
    dur: 0.5,
    build: (ctx, out) => {
      thump(0, 120, 30, 0.3, 1.1)(ctx, out);
      noiseBurst(0, 0.16, 'lowpass', 900, 1, 0.6)(ctx, out);
    },
  },
  whoosh: {
    dur: 0.4,
    build: (ctx, out) => {
      const n = noise(ctx, 0.4);
      const f = filter(ctx, 'bandpass', 700, 2);
      f.frequency.setValueAtTime(400, 0);
      f.frequency.exponentialRampToValueAtTime(2200, 0.25);
      const e = envAHR(ctx, 0, 0.1, 0.05, 0.2, 0.35);
      n.connect(f).connect(e).connect(out);
      n.start(0);
    },
  },
  impact_soft: {
    dur: 0.3,
    build: (ctx, out) => {
      thump(0, 130, 60, 0.12, 0.6)(ctx, out);
      noiseBurst(0, 0.07, 'lowpass', 800, 1, 0.35)(ctx, out);
    },
  },
  impact_hard: {
    dur: 0.45,
    build: (ctx, out) => {
      thump(0, 160, 50, 0.18, 0.9)(ctx, out);
      noiseBurst(0, 0.1, 'bandpass', 1300, 1.4, 0.55)(ctx, out);
    },
  },
  pickup: {
    dur: 0.3,
    build: (ctx, out) => {
      noiseBurst(0, 0.06, 'bandpass', 1200, 1.5, 0.3)(ctx, out);
      const o = osc(ctx, 'sine', 660);
      const e = envPerc(ctx, 0.03, 0.005, 0.12, 0.1);
      o.connect(e).connect(out);
      o.start(0.03);
      o.stop(0.3);
    },
  },
  paper: {
    dur: 0.5,
    build: (ctx, out) => {
      for (let i = 0; i < 4; i++) {
        noiseBurst(i * 0.09, 0.07, 'highpass', 2200, 1, 0.2, 0.01)(ctx, out);
      }
    },
  },
  cloth: {
    dur: 0.45,
    build: (ctx, out) => {
      noiseBurst(0, 0.3, 'bandpass', 1100, 0.7, 0.2, 0.05)(ctx, out);
    },
  },
  ui_click: {
    dur: 0.09,
    build: (ctx, out) => {
      noiseBurst(0, 0.02, 'bandpass', 1900, 4, 0.3)(ctx, out);
    },
  },
  ladder: {
    dur: 0.8,
    build: (ctx, out) => {
      for (const t0 of [0, 0.22, 0.44]) {
        thump(t0, 130, 70, 0.08, 0.4)(ctx, out);
        noiseBurst(t0, 0.05, 'bandpass', 900, 2, 0.25)(ctx, out);
      }
    },
  },

  /* ---- The Keeper ---- */
  keeper_breath: {
    dur: 4.4,
    loop: true,
    loopBlend: 0.5,
    volume: 0.9,
    build: (ctx, out) => {
      for (const [t0, dur, dir] of [
        [0.2, 1.4, 1],
        [2.4, 1.6, -1],
      ] as const) {
        const n = noise(ctx, dur + 0.3);
        const f = filter(ctx, 'bandpass', 420, 1.1);
        f.frequency.setValueAtTime(dir > 0 ? 320 : 520, t0);
        f.frequency.linearRampToValueAtTime(dir > 0 ? 560 : 300, t0 + dur);
        const e = envAHR(ctx, t0, dur * 0.45, 0.1, dur * 0.5, 0.3);
        const sh = shaper(ctx, 3);
        n.connect(f).connect(sh).connect(e).connect(out);
        n.start(t0);
      }
      const sub = osc(ctx, 'sine', 43);
      const sg = gain(ctx, 0.06);
      sub.connect(sg).connect(out);
      sub.start(0);
    },
  },
  keeper_step: {
    dur: 0.5,
    build: (ctx, out) => {
      thump(0, 70, 28, 0.3, 1.1)(ctx, out);
      noiseBurst(0.06, 0.22, 'lowpass', 350, 0.8, 0.3, 0.03)(ctx, out); // the drag
    },
  },
  keeper_alert: {
    dur: 1.0,
    build: (ctx, out) => {
      const o = osc(ctx, 'sawtooth', 130);
      o.frequency.setValueAtTime(160, 0);
      o.frequency.exponentialRampToValueAtTime(60, 0.8);
      const sh = shaper(ctx, 14);
      const f = filter(ctx, 'lowpass', 900);
      const e = envAHR(ctx, 0, 0.05, 0.3, 0.5, 0.5);
      o.connect(sh).connect(f).connect(e).connect(out);
      o.start(0);
      o.stop(1.0);
      noiseBurst(0, 0.4, 'bandpass', 800, 1, 0.25, 0.02)(ctx, out);
    },
  },
  keeper_scream: {
    dur: 1.8,
    build: (ctx, out) => {
      for (const detune of [0, 13, -9]) {
        const o = osc(ctx, 'sawtooth', 220 + detune);
        o.frequency.setValueAtTime(180 + detune, 0);
        o.frequency.linearRampToValueAtTime(700 + detune * 3, 0.35);
        o.frequency.linearRampToValueAtTime(240 + detune, 1.5);
        const sh = shaper(ctx, 9);
        const f = filter(ctx, 'bandpass', 1300, 1.2);
        const e = envAHR(ctx, 0, 0.08, 0.7, 0.9, 0.3);
        o.connect(sh).connect(f).connect(e).connect(out);
        o.start(0);
        o.stop(1.8);
      }
      const n = noise(ctx, 1.6);
      const nf = filter(ctx, 'highpass', 1500, 0.8);
      const ne = envAHR(ctx, 0, 0.1, 0.5, 1.0, 0.3);
      n.connect(nf).connect(ne).connect(out);
      n.start(0);
    },
  },
  keeper_attack: {
    dur: 0.7,
    build: (ctx, out) => {
      const n = noise(ctx, 0.3);
      const f = filter(ctx, 'bandpass', 900, 1.5);
      f.frequency.exponentialRampToValueAtTime(3000, 0.15);
      const e = envAHR(ctx, 0, 0.04, 0.06, 0.15, 0.6);
      n.connect(f).connect(e).connect(out);
      n.start(0);
      thump(0.16, 130, 35, 0.3, 1.2)(ctx, out);
    },
  },
  jumpscare: {
    dur: 1.4,
    volume: 1.1,
    build: (ctx, out) => {
      for (const f0 of [180, 190.5, 240, 361]) {
        const o = osc(ctx, 'sawtooth', f0);
        const sh = shaper(ctx, 10);
        const e = envAHR(ctx, 0, 0.01, 0.5, 0.7, 0.3);
        o.connect(sh).connect(e).connect(out);
        o.start(0);
        o.stop(1.3);
      }
      const n = noise(ctx, 1.2);
      const nf = filter(ctx, 'highpass', 900, 1);
      const ne = envAHR(ctx, 0, 0.005, 0.35, 0.7, 0.5);
      n.connect(nf).connect(ne).connect(out);
      n.start(0);
    },
  },

  /* ---- Music ---- */
  drone: {
    dur: 14,
    loop: true,
    loopBlend: 2.5,
    stereo: true,
    volume: 0.8,
    build: (ctx, out) => {
      for (const [f0, g0] of [
        [55, 0.1],
        [55.6, 0.08],
        [82.4, 0.05],
        [110.7, 0.03],
      ] as const) {
        const o = osc(ctx, 'sawtooth', f0);
        const f = filter(ctx, 'lowpass', 240, 0.6);
        const lfo = osc(ctx, 'sine', 0.05 + f0 * 0.0007);
        const lg = gain(ctx, 90);
        lfo.connect(lg).connect(f.frequency);
        const g1 = gain(ctx, g0);
        o.connect(f).connect(g1).connect(out);
        o.start(0);
        lfo.start(0);
      }
      // faint metallic shimmer
      const shimmer = osc(ctx, 'sine', 1108);
      const sg = gain(ctx, 0);
      sg.gain.setValueAtTime(0, 0);
      sg.gain.linearRampToValueAtTime(0.012, 6);
      sg.gain.linearRampToValueAtTime(0, 12);
      shimmer.connect(sg).connect(out);
      shimmer.start(0);
    },
  },
  chase: {
    dur: 8,
    loop: true,
    loopBlend: 0.9,
    stereo: true,
    volume: 0.9,
    build: (ctx, out) => {
      const bpm = 138;
      const beat = 60 / bpm;
      for (let i = 0; i < 8 / beat; i++) {
        const t0 = i * beat;
        thump(t0, 85, 40, 0.12, i % 4 === 0 ? 0.9 : 0.55)(ctx, out);
        if (i % 2 === 1) noiseBurst(t0, 0.05, 'highpass', 2500, 1, 0.14)(ctx, out);
      }
      for (const [f0, g0] of [
        [98, 0.06],
        [103.8, 0.06],
        [196, 0.04],
      ] as const) {
        const o = osc(ctx, 'sawtooth', f0);
        const f = filter(ctx, 'bandpass', 600, 2);
        const lfo = osc(ctx, 'sine', 0.9);
        const lg = gain(ctx, 300);
        lfo.connect(lg).connect(f.frequency);
        const g1 = gain(ctx, g0);
        o.connect(f).connect(g1).connect(out);
        o.start(0);
        lfo.start(0);
      }
    },
  },
  stinger: {
    dur: 2.2,
    volume: 0.9,
    build: (ctx, out) => {
      for (const f0 of [220, 233, 311, 466]) {
        const o = osc(ctx, 'sawtooth', f0);
        const e = envAHR(ctx, 0, 0.01, 0.25, 1.4, 0.16);
        const f = filter(ctx, 'lowpass', 2600);
        o.connect(f).connect(e).connect(out);
        o.start(0);
        o.stop(2.0);
      }
      thump(0, 90, 30, 0.8, 0.9)(ctx, out);
    },
  },
  victory_tone: {
    dur: 4,
    volume: 0.8,
    build: (ctx, out) => {
      for (const [t0, f0] of [
        [0, 220],
        [0.5, 277],
        [1.0, 330],
        [1.5, 440],
      ] as const) {
        const o = osc(ctx, 'triangle', f0);
        const e = envAHR(ctx, t0, 0.1, 0.8, 1.8, 0.12);
        o.connect(e).connect(out);
        o.start(t0);
        o.stop(t0 + 3);
      }
    },
  },
};

export type SoundName = keyof typeof SOUND_DEFS;

export interface RenderedSound {
  url: string;
  loop: boolean;
  volume: number;
}

export async function synthesizeAll(
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, RenderedSound>> {
  const names = Object.keys(SOUND_DEFS);
  const out: Record<string, RenderedSound> = {};
  let done = 0;
  for (const name of names) {
    const def = SOUND_DEFS[name];
    const buffer = await renderSound(def.dur, def.build, {
      channels: def.stereo ? 2 : 1,
      loopBlend: def.loop ? (def.loopBlend ?? 0.15) : 0,
    });
    out[name] = { url: bufferToWavUrl(buffer), loop: !!def.loop, volume: def.volume ?? 1 };
    done++;
    onProgress?.(done, names.length);
    // Yield to the UI thread so the loading bar animates.
    if (done % 6 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

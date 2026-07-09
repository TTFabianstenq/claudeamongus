"use client";

/**
 * All sound effects are synthesized with the WebAudio API at runtime —
 * zero audio assets ship with the game, which also means every sound is
 * royalty-free by construction. Each effect is a tiny procedural patch.
 */

type EffectName =
  | "footstep"
  | "kill"
  | "report"
  | "meeting"
  | "vote"
  | "victory"
  | "defeat"
  | "sabotage"
  | "door"
  | "vent"
  | "task"
  | "click"
  | "eject";

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.8;
  private lastFootstep = 0;

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }
  }

  /** Must be called from a user gesture at least once (browser autoplay). */
  unlock(): void {
    this.ensure();
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  play(name: EffectName): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state !== "running") return;
    const now = ctx.currentTime;
    switch (name) {
      case "footstep": {
        if (performance.now() - this.lastFootstep < 220) return;
        this.lastFootstep = performance.now();
        this.noise(0.04, 900 + Math.random() * 300, 0.12);
        break;
      }
      case "kill": {
        this.sweep(340, 60, 0.35, "sawtooth", 0.5);
        this.noise(0.25, 300, 0.3);
        break;
      }
      case "report": {
        this.tone(880, 0.12, "square", 0.35, now);
        this.tone(660, 0.12, "square", 0.35, now + 0.14);
        this.tone(880, 0.2, "square", 0.35, now + 0.28);
        break;
      }
      case "meeting": {
        for (let i = 0; i < 4; i++) {
          this.tone(523, 0.09, "square", 0.4, now + i * 0.12);
        }
        this.tone(784, 0.4, "square", 0.4, now + 0.5);
        break;
      }
      case "vote": {
        this.tone(1200, 0.05, "sine", 0.3, now);
        this.tone(1600, 0.07, "sine", 0.25, now + 0.06);
        break;
      }
      case "victory": {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => this.tone(f, 0.22, "triangle", 0.4, now + i * 0.14));
        break;
      }
      case "defeat": {
        const notes = [392, 349, 311, 262];
        notes.forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.3, now + i * 0.18));
        break;
      }
      case "sabotage": {
        this.sweep(220, 440, 0.5, "square", 0.25);
        this.sweep(440, 220, 0.5, "square", 0.25, 0.5);
        break;
      }
      case "door": {
        this.sweep(200, 70, 0.25, "square", 0.35);
        this.noise(0.12, 200, 0.25);
        break;
      }
      case "vent": {
        this.noise(0.18, 500, 0.3);
        this.sweep(150, 400, 0.18, "sine", 0.2);
        break;
      }
      case "task": {
        this.tone(660, 0.08, "sine", 0.35, now);
        this.tone(990, 0.12, "sine", 0.35, now + 0.09);
        break;
      }
      case "click": {
        this.tone(500, 0.03, "square", 0.15, now);
        break;
      }
      case "eject": {
        this.sweep(500, 100, 1.2, "sine", 0.3);
        break;
      }
      default:
        break;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    startAt?: number,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const start = startAt ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private sweep(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    delay = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(duration: number, filterFreq: number, gainValue: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }
}

export const soundManager = new SoundManager();

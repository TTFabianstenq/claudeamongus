/**
 * Offline audio synthesis toolkit.
 *
 * HOLLOWMOOR ships zero audio files: every sound — footsteps, thunder, the
 * Keeper's breathing, the score — is rendered at load time into WAV blobs
 * using OfflineAudioContext, then handed to Howler for playback. Builders
 * get a full WebAudio node graph (filters, waveshapers, delays), so the
 * palette is genuinely synthesised sound design, not beeps.
 */

export const SAMPLE_RATE = 24000;

type OfflineCtor = typeof OfflineAudioContext;

function getOfflineCtor(): OfflineCtor {
  const w = window as unknown as {
    OfflineAudioContext?: OfflineCtor;
    webkitOfflineAudioContext?: OfflineCtor;
  };
  const ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!ctor) throw new Error('OfflineAudioContext unsupported');
  return ctor;
}

export type SoundBuilder = (ctx: OfflineAudioContext, out: GainNode) => void;

export async function renderSound(
  duration: number,
  build: SoundBuilder,
  opts: { channels?: number; loopBlend?: number } = {}
): Promise<AudioBuffer> {
  const Ctor = getOfflineCtor();
  const channels = opts.channels ?? 1;
  const blend = opts.loopBlend ?? 0;
  const ctx = new Ctor(channels, Math.ceil((duration + blend) * SAMPLE_RATE), SAMPLE_RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  build(ctx, out);
  let buffer = await ctx.startRendering();
  if (blend > 0) buffer = crossfadeLoop(buffer, duration, blend);
  return buffer;
}

/** Fold the tail into the head so loops are click-free and seamless. */
function crossfadeLoop(src: AudioBuffer, loopLen: number, blend: number): AudioBuffer {
  const Ctor = getOfflineCtor();
  const sr = src.sampleRate;
  const loopSamples = Math.floor(loopLen * sr);
  const blendSamples = Math.min(Math.floor(blend * sr), src.length - loopSamples);
  const ctx = new Ctor(src.numberOfChannels, loopSamples, sr);
  const out = ctx.createBuffer(src.numberOfChannels, loopSamples, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const input = src.getChannelData(ch);
    const data = out.getChannelData(ch);
    data.set(input.subarray(0, loopSamples));
    for (let i = 0; i < blendSamples; i++) {
      const t = i / blendSamples;
      data[i] = data[i] * t + input[loopSamples + i] * (1 - t);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Node helpers for builders                                           */
/* ------------------------------------------------------------------ */

let sharedNoise: Float32Array | null = null;

/** Deterministic white noise (xorshift) reused across builders. */
export function noiseBuffer(ctx: BaseAudioContext, duration: number): AudioBuffer {
  const len = Math.ceil(duration * ctx.sampleRate);
  if (!sharedNoise || sharedNoise.length < len) {
    const n = Math.max(len, ctx.sampleRate * 16);
    sharedNoise = new Float32Array(n);
    let s = 0x1badf00d;
    for (let i = 0; i < n; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      sharedNoise[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    }
  }
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  buf.getChannelData(0).set(sharedNoise.subarray(0, len));
  return buf;
}

export function noise(ctx: BaseAudioContext, duration: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  return src;
}

export function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

export function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

export function filter(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  freq: number,
  q = 1
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Percussive envelope: instant-ish attack, exponential decay. */
export function envPerc(
  ctx: BaseAudioContext,
  start: number,
  attack: number,
  decay: number,
  peak = 1
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return g;
}

/** Attack–hold–release envelope. */
export function envAHR(
  ctx: BaseAudioContext,
  start: number,
  attack: number,
  hold: number,
  release: number,
  peak = 1
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.setValueAtTime(peak, start + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  return g;
}

/** Soft-clip waveshaper for growls and distortion. */
export function shaper(ctx: BaseAudioContext, amount = 8): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  ws.curve = curve;
  return ws;
}

/** Cheap reverb tail: feedback delay into a lowpass. */
export function tail(
  ctx: BaseAudioContext,
  wet = 0.3,
  time = 0.09,
  feedback = 0.55,
  tone = 1600
): { input: AudioNode; output: AudioNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = gain(ctx, 1);
  input.connect(dry).connect(output);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = time;
  const fb = gain(ctx, feedback);
  const lp = filter(ctx, 'lowpass', tone);
  const wetGain = gain(ctx, wet);
  input.connect(delay);
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(wetGain).connect(output);
  return { input, output };
}

/* ------------------------------------------------------------------ */
/* WAV encoding                                                        */
/* ------------------------------------------------------------------ */

export function bufferToWavUrl(buffer: AudioBuffer): string {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const bytesPerSample = 2;
  const dataSize = length * channels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }

  return URL.createObjectURL(new Blob([arrayBuffer], { type: 'audio/wav' }));
}

/** Small math helpers shared across gameplay systems. */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Frame-rate independent exponential damping.
 * `lambda` ≈ how quickly the value converges (higher = snappier).
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const TWO_PI = Math.PI * 2;

/** Shortest signed difference between two angles. */
export const angleDelta = (a: number, b: number): number => {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
};

export const dampAngle = (current: number, target: number, lambda: number, dt: number): number =>
  current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt));

export const dist2d = (ax: number, az: number, bx: number, bz: number): number =>
  Math.hypot(bx - ax, bz - az);

export const dist3d = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number => Math.hypot(bx - ax, by - ay, bz - az);

export const pointInRect = (
  x: number,
  z: number,
  rect: [number, number, number, number],
  pad = 0
): boolean => x >= rect[0] - pad && x <= rect[2] + pad && z >= rect[1] - pad && z <= rect[3] + pad;

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Small deterministic PRNG (mulberry32) plus crypto-strength helpers for
 * things that must be unpredictable (room codes, tokens, role assignment).
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates using a supplied random source. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = a;
  }
  return arr;
}

export function pick<T>(items: readonly T[], random: () => number = Math.random): T {
  if (items.length === 0) throw new Error("pick() from empty array");
  return items[Math.floor(random() * items.length)] as T;
}

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Cryptographically random room code (works in Node and the browser). */
export function randomRoomCode(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

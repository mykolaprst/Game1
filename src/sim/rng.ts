// Deterministic, stateless randomness: every roll is derived from the save's seed plus a key,
// so the same seed and the same choices always give the same result.
export function hash(seed: number, ...keys: (string | number)[]): number {
  let h = (2166136261 ^ seed) >>> 0;
  const s = keys.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // final avalanche (mulberry32 step)
  h = (h + 0x6d2b79f5) >>> 0;
  let t = Math.imul(h ^ (h >>> 15), 1 | h);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

/** Uniform in [0, 1). */
export function rand(seed: number, ...keys: (string | number)[]): number {
  return hash(seed, ...keys) / 4294967296;
}

export function pick<T>(list: T[], seed: number, ...keys: (string | number)[]): T {
  return list[Math.floor(rand(seed, ...keys) * list.length)];
}

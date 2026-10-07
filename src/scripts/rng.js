// A serializable xorshift32 stream keeps each dynasty reproducible across saves.
export function hashSeed(value) {
  const text = String(value ?? 'lineage-engine');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function nextRandom(state) {
  const world = state?.$world;
  if (!world) return 0.5;
  let x = (world.rngState ?? hashSeed(world.seed ?? world.dynastyName)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  world.rngState = x >>> 0 || 1;
  return world.rngState / 0x100000000;
}

export function createSeededRng(seed) {
  const state = { $world: { seed, rngState: hashSeed(seed) } };
  return () => nextRandom(state);
}

export function stateRng(state, injected) {
  return typeof injected === 'function' ? injected : () => nextRandom(state);
}

let fallbackState = { $world: { seed: 'lineage-engine', rngState: hashSeed('lineage-engine') } };
export function rng() {
  const sugarCubeRng = globalThis.SugarCube?.State?.prng?.random;
  if (typeof sugarCubeRng === 'function') return sugarCubeRng.call(globalThis.SugarCube.State.prng);
  return nextRandom(fallbackState);
}

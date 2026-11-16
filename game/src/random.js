// LUMEN TIDE — seeded randomness. The whole simulation runs on this one
// generator, never on Math.random, so a seed always replays the same game
// (and the ?shot= screenshots are the same frame every time).

/** mulberry32: small, fast, deterministic. Seed is any 32-bit integer. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from the seeded generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One of the array's entries, from the seeded generator. */
export function randomPick(random, entries) {
  return entries[Math.floor(random() * entries.length)];
}

/** An angle in radians, uniform over the circle. */
export function randomAngle(random) {
  return random() * Math.PI * 2;
}

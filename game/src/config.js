// LUMEN TIDE — every tuning number, colour and wave in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** localStorage key for the best score. */
export const BEST_KEY = 'lumentide.best';

/** Shards of light needed to reignite the Beacon. */
export const CHARGE_GOAL = 150;

/** The last wave. Clearing it with a full charge wins the game. */
export const LAST_WAVE = 10;

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 430,
  drag: 3.2,
  hull: 100,
  fireInterval: 0.16,
  boltSpeed: 780,
  boltDamage: 1,
  boltRadius: 5,
  dashSpeed: 950,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnAfterHit: 1.2,
  shardMagnet: 150,
};

export const BOLT = { life: 1.1 };

/** Enemy kinds, their look and their numbers. Speed and hp grow per wave. */
export const ENEMY = {
  drifter: {
    radius: 18, hp: 1, speed: 95, speedPerWave: 9, damage: 12,
    score: 50, shards: 2, colour: '#ff5d73', dark: '#a32c40',
  },
  spinner: {
    radius: 20, hp: 2, speed: 72, speedPerWave: 6, damage: 10,
    score: 80, shards: 3, colour: '#b388ff', dark: '#6a4fb0',
    fireInterval: 2.4, orbSpeed: 190, orbRadius: 7,
  },
  mine: {
    radius: 16, hp: 1, speed: 34, speedPerWave: 3, damage: 22,
    score: 40, shards: 1, colour: '#ffb454', dark: '#a86a1d',
    armRadius: 96, explodeRadius: 96,
  },
  herald: {
    radius: 46, hp: 42, speed: 46, speedPerWave: 0, damage: 18,
    score: 500, shards: 20, colour: '#ffe08a', dark: '#a8842a',
    fireInterval: 1.7, orbSpeed: 210, orbRadius: 9,
  },
};

/** Wave table: how many of each kind each wave spawns, and how fast. */
export const WAVES = [
  null,
  { drifter: 6, spinner: 0, mine: 0, herald: 0, interval: 1.15 },
  { drifter: 9, spinner: 2, mine: 0, herald: 0, interval: 1.05 },
  { drifter: 10, spinner: 3, mine: 3, herald: 0, interval: 0.95 },
  { drifter: 12, spinner: 4, mine: 4, herald: 0, interval: 0.88 },
  { drifter: 12, spinner: 5, mine: 5, herald: 1, interval: 0.82 },
  { drifter: 14, spinner: 6, mine: 6, herald: 0, interval: 0.76 },
  { drifter: 15, spinner: 8, mine: 7, herald: 0, interval: 0.70 },
  { drifter: 16, spinner: 9, mine: 9, herald: 0, interval: 0.64 },
  { drifter: 18, spinner: 10, mine: 10, herald: 0, interval: 0.58 },
  { drifter: 16, spinner: 10, mine: 10, herald: 1, interval: 0.52 },
];

export const WAVE_NAMES = [
  '',
  'First Light',
  'The Hollow Stirs',
  'Teeth in the Dark',
  'Spinner Choir',
  'The Herald Comes',
  'Amber Tide',
  'Crossfire',
  'The Long Night',
  'Edge of Dawn',
  'Reignite the Beacon',
];

/** Combo: scoring events within this window keep the chain alive. */
export const COMBO = {
  window: 3.0,
  perLevel: 8,
  maxMult: 5,
  step: 0.5,
};

/** Ambient shards that drift in on their own, so charge is never stuck. */
export const AMBIENT_SHARD = { interval: 2.5, maxOnField: 6 };

export const POWERUP = {
  dropChance: 0.09,
  overchargeSeconds: 8,
  magnetSeconds: 8,
  magnetRadius: 320,
};

/** The palette. One coherent indigo / cyan / gold night. */
export const PALETTE = {
  spaceTop: '#0b1026',
  spaceBottom: '#141b3d',
  nebulaCyan: 'rgba(64, 140, 220, 0.20)',
  nebulaViolet: 'rgba(140, 90, 220, 0.16)',
  nebulaGold: 'rgba(255, 190, 90, 0.10)',
  player: '#57e6ff',
  playerDark: '#1d7f9e',
  gold: '#ffd166',
  text: '#eaf2ff',
  textDim: '#9fb2d8',
  danger: '#ff5d73',
  ok: '#7dffb2',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

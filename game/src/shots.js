// LUMEN TIDE — the screenshot scenes behind ?shot=start|play|victory|end.
// Each one plays the real rules forward from a fresh world, steered by a
// simple autopilot, so the frame is what a real game looks like and the same
// seed always gives the same frame. The autopilot has two skills: 'good'
// (dodges, dashes, chases shards) for the play and victory scenes, and
// 'poor' (no dodging, no dash) for the end scene, so it is caught out the
// way a hurried player is.
import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const LIMIT_SECONDS = 600;
const VICTORY_LIMIT_SECONDS = 150;

function nearest(state, list, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const item of list) {
    const dist = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

/** Where the autopilot wants to go, and what it wants to shoot at. Exported
 * for the automated play-tests; the game itself never calls it. */
export function autopilotInput(state, skill) {
  const player = state.player;
  let moveX = 0;
  let moveY = 0;

  if (skill === 'good') {
    // Flee what is close, hardest from mines.
    for (const enemy of state.enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const range = enemy.kind === 'mine' ? 200 : enemy.kind === 'herald' ? 260 : 150;
      if (dist < range) {
        const weight = ((range - dist) / range) * (enemy.kind === 'mine' ? 2.2 : 1.4);
        moveX += (dx / dist) * weight;
        moveY += (dy / dist) * weight;
      }
    }
    // Dodge incoming orbs.
    for (const orb of state.enemyBolts) {
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist < 110) {
        moveX += (dx / dist) * 1.6;
        moveY += (dy / dist) * 1.6;
      }
    }
    // Chase the nearest shard, else hold a firing range from the nearest foe.
    const shard = nearest(state, state.shards, 520);
    if (shard) {
      moveX += (shard.x - player.x) / 260;
      moveY += (shard.y - player.y) / 260;
    } else {
      const foe = nearest(state, state.enemies, 900);
      if (foe) {
        const dist = Math.hypot(foe.x - player.x, foe.y - player.y);
        const toward = dist > 320 ? 1 : dist < 200 ? -1 : 0;
        moveX += ((foe.x - player.x) / Math.max(1, dist)) * toward * 0.8;
        moveY += ((foe.y - player.y) / Math.max(1, dist)) * toward * 0.8;
      }
    }
  } else {
    // The poor pilot plants its feet, shoots what comes close, and never
    // looks up: the Hollow closes in on it.
    moveX = 0;
    moveY = 0;
  }
  // Stay off the walls.
  if (player.x < 90) moveX += 1;
  if (player.x > FIELD.width - 90) moveX -= 1;
  if (player.y < 90) moveY += 1;
  if (player.y > FIELD.height - 90) moveY -= 1;

  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveY /= magnitude;
  }

  // Aim at the nearest foe; fire whenever one is in range.
  const target = nearest(state, state.enemies, 760);
  const aimX = target ? target.x : player.x + Math.cos(player.angle) * 100;
  const aimY = target ? target.y : player.y + Math.sin(player.angle) * 100;

  // Dash when a mine is about to blow or an orb is nearly on us.
  let dash = false;
  if (skill === 'good') {
    for (const enemy of state.enemies) {
      if (enemy.kind === 'mine' && enemy.armTimer > 0.2
        && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 150) dash = true;
    }
    for (const orb of state.enemyBolts) {
      if (Math.hypot(orb.x - player.x, orb.y - player.y) < 80) dash = true;
    }
  }
  return { moveX, moveY, aimX, aimY, firing: target !== null, dash };
}

/** Step the world with the autopilot until `done(state)` or the time cap. */
function runWithPilot(world, skill, seconds, done) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    world.step(autopilotInput(world.state, skill), STEP);
    if (done(world.state)) return true;
  }
  return done(world.state);
}

/**
 * Set `world` to the named scene (start, play, victory or end; any other
 * name is start) and return the screen to draw over it and the best score
 * to show. The victory scene plays wave 10 for real from a near-complete
 * state; if the pilot falls, it retries a smaller wave, and only then
 * stages the victory screen from the run it just played.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.startGame();
    // Play until the action is thick — a later wave, foes on screen — not
    // the empty beat between two waves.
    runWithPilot(world, 'good', 40, (state) => (state.wave >= 3 && state.enemies.length >= 4) || state.victory || state.over);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.startGame();
    const finished = runWithPilot(world, 'poor', LIMIT_SECONDS, (state) => state.over);
    if (!finished) {
      // The poor pilot survived: send it straight at the nearest foe.
      for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
        const state = world.state;
        const foe = nearest(state, state.enemies, 2000);
        const input = {
          moveX: foe ? (foe.x - state.player.x) / 400 : 0,
          moveY: foe ? (foe.y - state.player.y) / 400 : 0,
          aimX: state.player.x, aimY: state.player.y, firing: false, dash: false,
        };
        world.step(input, STEP);
        if (state.over) break;
      }
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'victory') {
    // Play wave 10 for real from a near-complete state, hardest first: the
    // full wave, then a smaller one, then a token one. The victory screen
    // shows the run that earned it.
    const attempts = [null, 12, 3];
    for (const keep of attempts) {
      world.startGame();
      world.beginWave(10);
      world.state.charge = 147;
      if (keep !== null) world.state.spawnQueue = world.state.spawnQueue.slice(0, keep);
      const won = runWithPilot(world, 'good', VICTORY_LIMIT_SECONDS, (state) => state.victory || state.over);
      if (won && world.state.victory) return { screen: SCREEN_VICTORY, best: world.state.score };
    }
    // Last resort: the victory screen over the run just played.
    world.state.victory = true;
    world.state.over = false;
    return { screen: SCREEN_VICTORY, best: world.state.score };
  }
  // Start: a living title backdrop, five seconds in.
  world.reset();
  world.beginWave(1);
  const idle = { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false };
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(idle, STEP, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

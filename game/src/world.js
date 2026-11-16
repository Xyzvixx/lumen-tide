// LUMEN TIDE — the game's rules and state, with no drawing and no browser
// in it: the skiff, the Hollow's enemies, light shards, waves, combo, score,
// hull and the Beacon charge. step() advances one fixed step and returns the
// list of events that happened, so the caller can play sounds and shake the
// screen without the world knowing about either. Nothing here touches
// Math.random, Date or the network: only the seeded generator it was built
// with, so a seed replays the same game.

import {
  AMBIENT_SHARD, BOLT, CHARGE_GOAL, COMBO, ENEMY, FIELD, LAST_WAVE,
  PLAYER, POWERUP, WAVES,
} from './config.js';
import { randomAngle, randomInt, randomPick } from './random.js';

const TWO_PI = Math.PI * 2;

function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createWorld(random) {
  const state = {
    player: {
      x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
      angle: -Math.PI / 2, hull: PLAYER.hull, shield: false,
      fireTimer: 0, dashTimer: 0, dashCooldown: 0, invuln: 0,
      overchargeTimer: 0, magnetTimer: 0,
    },
    bolts: [],
    enemyBolts: [],
    enemies: [],
    shards: [],
    pickups: [],
    particles: [],
    floaters: [],
    score: 0,
    best: 0,
    charge: 0,
    wave: 0,
    bonusRounds: 0,
    wavePhase: 'banner',
    bannerTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    ambientTimer: AMBIENT_SHARD.interval,
    comboChain: 0,
    comboTimer: 0,
    comboMult: 1,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    elapsed: 0,
    shake: 0,
    flash: 0,
    victory: false,
    over: false,
    time: 0,
    harmless: false,
  };

  function reset() {
    const player = state.player;
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.hull = PLAYER.hull;
    player.shield = false;
    player.fireTimer = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.invuln = 0;
    player.overchargeTimer = 0;
    player.magnetTimer = 0;
    state.bolts.length = 0;
    state.enemyBolts.length = 0;
    state.enemies.length = 0;
    state.shards.length = 0;
    state.pickups.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.score = 0;
    state.charge = 0;
    state.wave = 0;
    state.bonusRounds = 0;
    state.wavePhase = 'banner';
    state.bannerTimer = 0;
    state.spawnQueue.length = 0;
    state.spawnTimer = 0;
    state.ambientTimer = AMBIENT_SHARD.interval;
    state.comboChain = 0;
    state.comboTimer = 0;
    state.comboMult = 1;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    state.victory = false;
    state.over = false;
    state.time = 0;
    state.harmless = false;
  }

  /** Where a new enemy enters: a field edge, never on top of the player. */
  function spawnPoint() {
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = randomInt(random, 0, 3);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = random() * FIELD.width; y = 40; }
      else if (edge === 1) { x = random() * FIELD.width; y = FIELD.height - 40; }
      else if (edge === 2) { x = 40; y = random() * FIELD.height; }
      else { x = FIELD.width - 40; y = random() * FIELD.height; }
      if (distance(x, y, state.player.x, state.player.y) > 240) return { x, y };
    }
    return { x: 60, y: 60 };
  }

  function enemySpeed(kind) {
    const spec = ENEMY[kind];
    return spec.speed + spec.speedPerWave * (state.wave - 1);
  }

  function spawnEnemy(kind) {
    const spec = ENEMY[kind];
    const point = spawnPoint();
    const enemy = {
      kind,
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      hp: spec.hp + (kind === 'drifter' && state.wave >= 7 ? 1 : 0)
        + (kind === 'spinner' && state.wave >= 8 ? 1 : 0),
      maxHp: spec.hp,
      speed: enemySpeed(kind),
      fireTimer: spec.fireInterval ? spec.fireInterval * (0.7 + random() * 0.6) : 0,
      wobble: random() * TWO_PI,
      wobbleSpeed: 1.5 + random() * 2,
      armTimer: 0,
      summoned: false,
      flash: 0,
    };
    if (kind === 'herald') enemy.maxHp = spec.hp;
    state.enemies.push(enemy);
    return enemy;
  }

  /** Build the wave's queue and shuffle it with the seeded generator. */
  function beginWave(number) {
    state.wave = number;
    const table = WAVES[number];
    const queue = [];
    for (const [kind, count] of Object.entries(table)) {
      if (kind === 'interval') continue;
      for (let i = 0; i < count; i += 1) queue.push(kind);
    }
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    state.spawnQueue = queue;
    state.spawnTimer = 0.6;
    state.wavePhase = 'banner';
    state.bannerTimer = number === 1 ? 2.4 : 2.0;
  }

  function startGame() {
    reset();
    beginWave(1);
  }

  function burst(x, y, colour, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = randomAngle(random);
      const velocity = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.4 + random() * 0.45,
        maxLife: 0.85,
        colour,
        size: 2 + random() * 3.5,
      });
    }
  }

  function addFloater(x, y, text, colour) {
    state.floaters.push({ x, y, text, colour, life: 0.9, maxLife: 0.9 });
  }

  function chainScore(base) {
    return Math.round(base * state.comboMult);
  }

  function bumpCombo() {
    state.comboChain += 1;
    state.comboTimer = COMBO.window;
    state.comboMult = Math.min(
      COMBO.maxMult,
      1 + Math.floor(state.comboChain / COMBO.perLevel) * COMBO.step,
    );
  }

  function dropShards(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = randomAngle(random);
      state.shards.push({
        x, y,
        vx: Math.cos(angle) * (40 + random() * 90),
        vy: Math.sin(angle) * (40 + random() * 90),
        radius: 8,
        spin: random() * TWO_PI,
        life: 14,
      });
    }
  }

  function maybeDropPowerup(x, y) {
    if (random() >= POWERUP.dropChance) return;
    const kind = randomPick(random, ['shield', 'overcharge', 'magnet']);
    state.pickups.push({ x, y, vx: 0, vy: 0, kind, radius: 14, life: 12 });
  }

  function collectShard(shard, events) {
    state.charge = Math.min(CHARGE_GOAL, state.charge + 1);
    state.score += chainScore(10);
    bumpCombo();
    burst(shard.x, shard.y, '#ffd166', 5, 120);
    events.push('pickup');
  }

  function applyPowerup(pickup, events) {
    const player = state.player;
    if (pickup.kind === 'shield') player.shield = true;
    else if (pickup.kind === 'overcharge') player.overchargeTimer = POWERUP.overchargeSeconds;
    else player.magnetTimer = POWERUP.magnetSeconds;
    addFloater(player.x, player.y - 30, pickup.kind.toUpperCase(), '#7dffb2');
    events.push('powerup');
  }

  function damagePlayer(amount, events) {
    const player = state.player;
    // Harmless mode (the title screen's living backdrop): nothing can hurt.
    if (state.harmless) return;
    if (player.invuln > 0 || player.dashTimer > 0 || state.over || state.victory) return;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.0;
      addFloater(player.x, player.y - 30, 'SHIELD DOWN', '#57e6ff');
      events.push('shield');
      return;
    }
    player.hull = Math.max(0, player.hull - amount);
    player.invuln = PLAYER.invulnAfterHit;
    state.flash = 0.35;
    state.shake = 10;
    state.comboChain = 0;
    state.comboMult = 1;
    state.comboTimer = 0;
    burst(player.x, player.y, '#ff5d73', 14, 260);
    events.push('hurt');
    if (player.hull <= 0) {
      state.over = true;
      burst(player.x, player.y, '#57e6ff', 40, 380);
      burst(player.x, player.y, '#ffd166', 24, 300);
      events.push('over');
    }
  }

  /** A mine goes off. Anything in the blast takes the hit; mines chain. */
  function detonateMine(mine, events, depth) {
    mine.hp = 0;
    burst(mine.x, mine.y, '#ffb454', 22, 340);
    burst(mine.x, mine.y, '#ff5d73', 10, 220);
    state.shake = Math.max(state.shake, 7);
    events.push('explode');
    if (distance(mine.x, mine.y, state.player.x, state.player.y) < ENEMY.mine.explodeRadius + PLAYER.radius) {
      damagePlayer(ENEMY.mine.damage, events);
    }
    if (depth < 3) {
      for (const other of state.enemies) {
        if (other !== mine && other.kind === 'mine' && other.hp > 0
          && distance(mine.x, mine.y, other.x, other.y) < ENEMY.mine.explodeRadius + 30) {
          detonateMine(other, events, depth + 1);
        }
      }
    }
  }

  function killEnemy(enemy, events) {
    const spec = ENEMY[enemy.kind];
    enemy.hp = 0;
    state.kills += 1;
    state.score += chainScore(spec.score);
    addFloater(enemy.x, enemy.y, `+${chainScore(spec.score)}`, spec.colour);
    bumpCombo();
    dropShards(enemy.x, enemy.y, spec.shards);
    maybeDropPowerup(enemy.x, enemy.y);
    burst(enemy.x, enemy.y, spec.colour, enemy.kind === 'herald' ? 46 : 16, enemy.kind === 'herald' ? 420 : 260);
    if (enemy.kind === 'herald') {
      state.shake = 14;
      events.push('explode');
    }
    events.push('kill');
  }

  function fireEnemyOrb(enemy, events) {
    const player = state.player;
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const spec = ENEMY[enemy.kind];
    state.enemyBolts.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * spec.orbSpeed,
      vy: Math.sin(angle) * spec.orbSpeed,
      radius: spec.orbRadius,
      life: 5,
    });
    events.push('enemyShoot');
  }

  function fireHeraldBurst(enemy, events) {
    const spec = ENEMY.herald;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TWO_PI + enemy.wobble;
      state.enemyBolts.push({
        x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
        y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
        vx: Math.cos(angle) * spec.orbSpeed,
        vy: Math.sin(angle) * spec.orbSpeed,
        radius: spec.orbRadius,
        life: 5,
      });
    }
    events.push('enemyShoot');
  }

  function stepPlayer(input, dt, events) {
    const player = state.player;
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (player.overchargeTimer > 0) player.overchargeTimer = Math.max(0, player.overchargeTimer - dt);
    if (player.magnetTimer > 0) player.magnetTimer = Math.max(0, player.magnetTimer - dt);

    const magnitude = Math.hypot(input.moveX, input.moveY);
    const nx = magnitude > 0 ? input.moveX / magnitude : 0;
    const ny = magnitude > 0 ? input.moveY / magnitude : 0;
    if (player.dashTimer > 0) {
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx += nx * PLAYER.accel * dt;
      player.vy += ny * PLAYER.accel * dt;
      const drag = Math.max(0, 1 - PLAYER.drag * dt);
      player.vx *= drag;
      player.vy *= drag;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > PLAYER.maxSpeed) {
        player.vx = (player.vx / speed) * PLAYER.maxSpeed;
        player.vy = (player.vy / speed) * PLAYER.maxSpeed;
      }
    }
    player.x = clamp(player.x + player.vx * dt, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y + player.vy * dt, PLAYER.radius, FIELD.height - PLAYER.radius);
    player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

    if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const dx = magnitude > 0 ? nx : Math.cos(player.angle);
      const dy = magnitude > 0 ? ny : Math.sin(player.angle);
      player.dashX = dx;
      player.dashY = dy;
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invuln = Math.max(player.invuln, 0.3);
      burst(player.x, player.y, '#57e6ff', 8, 200);
      events.push('dash');
    }

    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      const interval = player.overchargeTimer > 0 ? PLAYER.fireInterval / 2.2 : PLAYER.fireInterval;
      player.fireTimer = interval;
      const spread = 0.05;
      const aim = player.angle + (random() - 0.5) * spread;
      state.bolts.push({
        x: player.x + Math.cos(player.angle) * (PLAYER.radius + 6),
        y: player.y + Math.sin(player.angle) * (PLAYER.radius + 6),
        vx: Math.cos(aim) * PLAYER.boltSpeed,
        vy: Math.sin(aim) * PLAYER.boltSpeed,
        radius: PLAYER.boltRadius,
        life: BOLT.life,
      });
      state.shotsFired += 1;
      events.push('shoot');
    }
  }

  function stepEnemies(dt, events) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.wobble += enemy.wobbleSpeed * dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / dist;
      const uy = dy / dist;

      if (enemy.kind === 'drifter') {
        const wobble = Math.sin(enemy.wobble) * 0.5;
        enemy.vx = (ux + -uy * wobble) * enemy.speed;
        enemy.vy = (uy + ux * wobble) * enemy.speed;
      } else if (enemy.kind === 'spinner') {
        const want = 260;
        const radial = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
        enemy.vx = (ux * radial + -uy * 0.7) * enemy.speed;
        enemy.vy = (uy * radial + ux * 0.7) * enemy.speed;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && dist < 560) {
          enemy.fireTimer = ENEMY.spinner.fireInterval * (0.85 + random() * 0.3);
          fireEnemyOrb(enemy, events);
        }
      } else if (enemy.kind === 'mine') {
        enemy.vx = ux * enemy.speed;
        enemy.vy = uy * enemy.speed;
        if (dist < ENEMY.mine.armRadius) {
          enemy.armTimer += dt;
          if (enemy.armTimer > 0.5) detonateMine(enemy, events, 0);
        } else {
          enemy.armTimer = Math.max(0, enemy.armTimer - dt);
        }
      } else if (enemy.kind === 'herald') {
        enemy.vx = ux * enemy.speed;
        enemy.vy = uy * enemy.speed;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = ENEMY.herald.fireInterval;
          fireHeraldBurst(enemy, events);
        }
        if (!enemy.summoned && enemy.hp <= enemy.maxHp / 2) {
          enemy.summoned = true;
          spawnEnemy('drifter');
          spawnEnemy('drifter');
          addFloater(enemy.x, enemy.y - 60, 'THE HERALD CALLS', '#ffe08a');
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = clamp(enemy.x, enemy.radius, FIELD.width - enemy.radius);
      enemy.y = clamp(enemy.y, enemy.radius, FIELD.height - enemy.radius);
    }
  }

  function stepProjectiles(dt, events) {
    for (const bolt of state.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
    }
    for (const orb of state.enemyBolts) {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
    }
    // Player bolts against enemies.
    for (const bolt of state.bolts) {
      if (bolt.life <= 0) continue;
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (distance(bolt.x, bolt.y, enemy.x, enemy.y) < bolt.radius + enemy.radius) {
          bolt.life = 0;
          enemy.hp -= PLAYER.boltDamage;
          enemy.flash = 0.09;
          state.shotsHit += 1;
          burst(bolt.x, bolt.y, ENEMY[enemy.kind].colour, 4, 160);
          if (enemy.hp <= 0) {
            if (enemy.kind === 'mine') {
              killEnemy(enemy, events);
              detonateMine(enemy, events, 0);
            } else killEnemy(enemy, events);
          }
          break;
        }
      }
    }
    // Enemy orbs against the player.
    for (const orb of state.enemyBolts) {
      if (orb.life <= 0) continue;
      if (distance(orb.x, orb.y, state.player.x, state.player.y) < orb.radius + PLAYER.radius) {
        orb.life = 0;
        damagePlayer(ENEMY.spinner.damage, events);
      }
    }
    state.bolts = state.bolts.filter((bolt) => bolt.life > 0
      && bolt.x > -20 && bolt.x < FIELD.width + 20 && bolt.y > -20 && bolt.y < FIELD.height + 20);
    state.enemyBolts = state.enemyBolts.filter((orb) => orb.life > 0
      && orb.x > -20 && orb.x < FIELD.width + 20 && orb.y > -20 && orb.y < FIELD.height + 20);
  }

  function stepContacts(events) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.kind === 'mine') continue;
      if (distance(enemy.x, enemy.y, player.x, player.y) < enemy.radius + PLAYER.radius - 4) {
        damagePlayer(ENEMY[enemy.kind].damage, events);
        // Shove the enemy back so one touch is not a blender.
        const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        enemy.x += Math.cos(angle) * 26;
        enemy.y += Math.sin(angle) * 26;
        if (state.over) return;
      }
    }
    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  }

  function stepPickups(dt, events) {
    const player = state.player;
    const magnet = player.magnetTimer > 0 ? POWERUP.magnetRadius : PLAYER.shardMagnet;
    for (const shard of state.shards) {
      shard.life -= dt;
      shard.spin += dt * 4;
      const dist = distance(shard.x, shard.y, player.x, player.y);
      if (dist < magnet) {
        const pull = 900 * (1 - dist / (magnet + 60));
        shard.vx += ((player.x - shard.x) / Math.max(1, dist)) * pull * dt;
        shard.vy += ((player.y - shard.y) / Math.max(1, dist)) * pull * dt;
      }
      shard.vx *= Math.max(0, 1 - 2.4 * dt);
      shard.vy *= Math.max(0, 1 - 2.4 * dt);
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (dist < PLAYER.radius + shard.radius + 4 && !state.harmless) {
        shard.life = 0;
        collectShard(shard, events);
        if (state.victory || state.over) return;
      }
    }
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      const dist = distance(pickup.x, pickup.y, player.x, player.y);
      if (dist < magnet) {
        pickup.vx += ((player.x - pickup.x) / Math.max(1, dist)) * 500 * dt;
        pickup.vy += ((player.y - pickup.y) / Math.max(1, dist)) * 500 * dt;
      }
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      if (dist < PLAYER.radius + pickup.radius + 4 && !state.harmless) {
        pickup.life = 0;
        applyPowerup(pickup, events);
      }
    }
    state.shards = state.shards.filter((shard) => shard.life > 0);
    state.pickups = state.pickups.filter((pickup) => pickup.life > 0);
  }

  function stepParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - 2.0 * dt);
      particle.vy *= Math.max(0, 1 - 2.0 * dt);
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    for (const floater of state.floaters) {
      floater.life -= dt;
      floater.y -= 34 * dt;
    }
    state.floaters = state.floaters.filter((floater) => floater.life > 0);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
  }

  function checkWaveClear(events) {
    if (state.wavePhase !== 'fight') return;
    if (state.spawnQueue.length > 0 || state.enemies.length > 0) return;
    state.wavePhase = 'clear';
    const bonus = state.wave * 100;
    state.score += chainScore(bonus);
    addFloater(state.player.x, state.player.y - 40, `WAVE CLEAR +${chainScore(bonus)}`, '#7dffb2');
    if (state.wave >= LAST_WAVE && state.charge >= CHARGE_GOAL) {
      state.victory = true;
      events.push('victory');
      return;
    }
    if (state.wave >= LAST_WAVE) {
      // The Beacon still hungers: the Reef offers one more round of light.
      state.bonusRounds += 1;
      beginWave(LAST_WAVE);
      state.bannerTimer = 2.0;
      return;
    }
    beginWave(state.wave + 1);
  }

  /**
   * One fixed step of live play. `input` carries moveX/moveY (-1..1), aimX/
   * aimY (logical field coordinates), firing and dash. `harmless` runs the
   * world as a living backdrop (title screen): things drift and spawn, but
   * nothing scores, nothing hurts and no wave ever clears. Returns the
   * events that happened this step, as strings.
   */
  function step(input, dt, harmless = false) {
    const events = [];
    state.harmless = harmless;
    state.time += dt;
    state.elapsed += dt;

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboChain = 0;
        state.comboMult = 1;
      }
    }

    if (state.wavePhase === 'banner') {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        state.wavePhase = 'fight';
        events.push('wave');
      }
    } else if (state.wavePhase === 'fight') {
      const table = WAVES[state.wave];
      state.spawnTimer -= dt;
      if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = table.interval * (0.85 + random() * 0.3);
      }
    }

    state.ambientTimer -= dt;
    if (state.ambientTimer <= 0) {
      state.ambientTimer = AMBIENT_SHARD.interval;
      const onField = state.shards.length;
      if (onField < AMBIENT_SHARD.maxOnField) {
        const angle = randomAngle(random);
        state.shards.push({
          x: FIELD.width / 2 + Math.cos(angle) * (180 + random() * 320),
          y: FIELD.height / 2 + Math.sin(angle) * (120 + random() * 180),
          vx: 0, vy: 0, radius: 8, spin: random() * TWO_PI, life: 14,
        });
        state.shards[state.shards.length - 1].x = clamp(state.shards[state.shards.length - 1].x, 30, FIELD.width - 30);
        state.shards[state.shards.length - 1].y = clamp(state.shards[state.shards.length - 1].y, 30, FIELD.height - 30);
      }
    }

    stepPlayer(input, dt, events);
    if (!state.over && !state.victory) {
      stepEnemies(dt, events);
      stepProjectiles(dt, events);
      stepContacts(events);
      stepPickups(dt, events);
    }
    stepParticles(dt);
    if (!state.harmless && !state.over && !state.victory) checkWaveClear(events);
    return events;
  }

  reset();
  return { state, reset, startGame, step, beginWave };
}

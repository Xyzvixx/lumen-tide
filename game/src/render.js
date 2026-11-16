// LUMEN TIDE — drawing only: the world's state and the current screen in,
// pixels out. The 1280x720 playfield is scaled to fit the window and
// centred, the margin filled with deep space. Vector art throughout — no
// images, no fonts fetched, system fonts only. All motion derives from the
// world's own clock, so a staged frame is the same frame every time.

import { CHARGE_GOAL, ENEMY, FIELD, FONT, LAST_WAVE, PALETTE, PLAYER, WAVE_NAMES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

/** Buttons, in logical field coordinates. main.js hit-tests clicks on these. */
export function screenButtons(screen) {
  const centre = FIELD.width / 2;
  if (screen === SCREEN_TITLE) {
    return [
      { id: 'start', x: centre - 130, y: 512, w: 260, h: 64 },
      { id: 'mute', x: FIELD.width - 64, y: 16, w: 48, h: 48 },
    ];
  }
  if (screen === SCREEN_PAUSED) {
    return [
      { id: 'resume', x: centre - 130, y: 392, w: 260, h: 56 },
      { id: 'restart', x: centre - 130, y: 460, w: 260, h: 56 },
      { id: 'mute', x: FIELD.width - 64, y: 16, w: 48, h: 48 },
    ];
  }
  if (screen === SCREEN_VICTORY || screen === SCREEN_OVER) {
    return [
      { id: 'restart', x: centre - 130, y: 545, w: 260, h: 64 },
      { id: 'menu', x: centre - 130, y: 620, w: 260, h: 48 },
    ];
  }
  return [{ id: 'mute', x: FIELD.width - 64, y: 16, w: 48, h: 48 }];
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  // The night sky, painted once: gradient, nebula clouds, three star layers.
  const sky = document.createElement('canvas');
  sky.width = FIELD.width;
  sky.height = FIELD.height;
  (function paintSky() {
    const skyContext = sky.getContext('2d');
    const gradient = skyContext.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    skyContext.fillStyle = gradient;
    skyContext.fillRect(0, 0, FIELD.width, FIELD.height);
    const clouds = [
      { x: 220, y: 180, r: 260, colour: PALETTE.nebulaCyan },
      { x: 980, y: 130, r: 300, colour: PALETTE.nebulaViolet },
      { x: 700, y: 560, r: 280, colour: PALETTE.nebulaGold },
      { x: 120, y: 600, r: 200, colour: PALETTE.nebulaViolet },
      { x: 1150, y: 480, r: 220, colour: PALETTE.nebulaCyan },
    ];
    for (const cloud of clouds) {
      const glow = skyContext.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
      glow.addColorStop(0, cloud.colour);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      skyContext.fillStyle = glow;
      skyContext.fillRect(cloud.x - cloud.r, cloud.y - cloud.r, cloud.r * 2, cloud.r * 2);
    }
    // Fixed stars from a tiny deterministic hash, not Math.random.
    let seed = 1337;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 190; i += 1) {
      const x = next() * FIELD.width;
      const y = next() * FIELD.height;
      const size = 0.6 + next() * 1.8;
      skyContext.fillStyle = next() > 0.85 ? 'rgba(255, 209, 102, 0.9)' : `rgba(234, 242, 255, ${0.35 + next() * 0.55})`;
      skyContext.beginPath();
      skyContext.arc(x, y, size, 0, Math.PI * 2);
      skyContext.fill();
    }
  })();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function font(size, weight = 400) {
    const key = `${weight}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, colour, align = 'left', weight = 400) {
    context.font = font(size, weight);
    context.fillStyle = colour;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function bar(x, y, width, height, fraction, fill, empty) {
    context.fillStyle = empty;
    context.fillRect(x, y, width, height);
    context.fillStyle = fill;
    context.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * width, height);
  }

  function button(buttonSpec, label, accent) {
    context.fillStyle = 'rgba(20, 30, 64, 0.92)';
    context.strokeStyle = accent;
    context.lineWidth = 2;
    roundRect(buttonSpec.x, buttonSpec.y, buttonSpec.w, buttonSpec.h, 10);
    context.fill();
    context.stroke();
    text(label, buttonSpec.x + buttonSpec.w / 2, buttonSpec.y + buttonSpec.h / 2 + 8, 22, PALETTE.text, 'center', 600);
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function drawShard(shard) {
    const pulse = 0.75 + 0.25 * Math.sin(shard.spin * 2);
    context.save();
    context.translate(shard.x, shard.y);
    context.rotate(shard.spin);
    context.globalAlpha = pulse;
    context.fillStyle = PALETTE.gold;
    context.shadowColor = PALETTE.gold;
    context.shadowBlur = 12;
    context.beginPath();
    context.moveTo(0, -9);
    context.lineTo(6, 0);
    context.lineTo(0, 9);
    context.lineTo(-6, 0);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawPickup(pickup, time) {
    const bob = Math.sin(time * 3 + pickup.x) * 3;
    const label = pickup.kind === 'shield' ? 'S' : pickup.kind === 'overcharge' ? 'O' : 'M';
    context.save();
    context.translate(pickup.x, pickup.y + bob);
    context.fillStyle = 'rgba(125, 255, 178, 0.16)';
    context.beginPath();
    context.arc(0, 0, 18, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#7dffb2';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 14, 0, Math.PI * 2);
    context.stroke();
    text(label, 0, 7, 18, '#7dffb2', 'center', 700);
    context.restore();
  }

  function drawDrifter(enemy, time) {
    context.save();
    context.translate(enemy.x, enemy.y);
    context.rotate(Math.sin(enemy.wobble) * 0.35);
    const spec = ENEMY.drifter;
    context.fillStyle = enemy.flash > 0 ? '#ffffff' : spec.colour;
    context.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const outer = i % 2 === 0 ? enemy.radius + 6 : enemy.radius - 2;
      const px = Math.cos(angle) * outer;
      const py = Math.sin(angle) * outer;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.fillStyle = spec.dark;
    context.beginPath();
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawSpinner(enemy, time) {
    context.save();
    context.translate(enemy.x, enemy.y);
    const spec = ENEMY.spinner;
    context.strokeStyle = enemy.flash > 0 ? '#ffffff' : spec.colour;
    context.lineWidth = 4;
    for (let arm = 0; arm < 3; arm += 1) {
      const angle = time * 1.6 + (arm / 3) * Math.PI * 2;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(Math.cos(angle) * (enemy.radius + 8), Math.sin(angle) * (enemy.radius + 8));
      context.stroke();
    }
    context.fillStyle = enemy.flash > 0 ? '#ffffff' : spec.colour;
    context.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + time * 0.4;
      const px = Math.cos(angle) * enemy.radius;
      const py = Math.sin(angle) * enemy.radius;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.fillStyle = spec.dark;
    context.beginPath();
    context.arc(0, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMine(enemy, time) {
    context.save();
    context.translate(enemy.x, enemy.y);
    const spec = ENEMY.mine;
    const armed = enemy.armTimer > 0;
    const pulse = 1 + 0.12 * Math.sin(time * (armed ? 14 : 4));
    context.fillStyle = armed && Math.floor(time * 10) % 2 === 0 ? '#ff2e4d' : (enemy.flash > 0 ? '#ffffff' : spec.colour);
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const outer = (i % 2 === 0 ? enemy.radius + 5 : enemy.radius - 3) * pulse;
      const px = Math.cos(angle) * outer;
      const py = Math.sin(angle) * outer;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.fillStyle = spec.dark;
    context.beginPath();
    context.arc(0, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHerald(enemy, time) {
    context.save();
    context.translate(enemy.x, enemy.y);
    const spec = ENEMY.herald;
    context.strokeStyle = enemy.flash > 0 ? '#ffffff' : spec.colour;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const start = time * 0.7 + (i / 6) * Math.PI * 2;
      context.beginPath();
      context.arc(0, 0, enemy.radius + 12, start, start + 0.7);
      context.stroke();
    }
    const core = context.createRadialGradient(0, 0, 0, 0, 0, enemy.radius - 8);
    core.addColorStop(0, '#fff6d8');
    core.addColorStop(0.6, spec.colour);
    core.addColorStop(1, spec.dark);
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, enemy.radius - 8, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Health arc above the Herald.
    context.save();
    context.translate(enemy.x, enemy.y - enemy.radius - 18);
    context.strokeStyle = 'rgba(234, 242, 255, 0.25)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, 12, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = spec.colour;
    context.beginPath();
    context.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + (enemy.hp / enemy.maxHp) * Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawEnemy(enemy, time) {
    if (enemy.kind === 'drifter') drawDrifter(enemy, time);
    else if (enemy.kind === 'spinner') drawSpinner(enemy, time);
    else if (enemy.kind === 'mine') drawMine(enemy, time);
    else drawHerald(enemy, time);
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (player.invuln > 0 && Math.floor(time * 12) % 2 === 0 && player.dashTimer <= 0) {
      // Blink while invulnerable after a hit — but stay visible while dashing.
    } else {
      context.save();
      context.translate(player.x, player.y);
      context.rotate(player.angle);
      context.shadowColor = PALETTE.player;
      context.shadowBlur = 18;
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.moveTo(22, 0);
      context.lineTo(-12, -13);
      context.lineTo(-6, 0);
      context.lineTo(-12, 13);
      context.closePath();
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = '#dffaff';
      context.beginPath();
      context.arc(4, 0, 5, 0, Math.PI * 2);
      context.fill();
      // Engine flame, flickering with the clock.
      const flame = 10 + 6 * Math.sin(time * 31) + 4 * Math.sin(time * 57);
      context.fillStyle = '#ffb454';
      context.beginPath();
      context.moveTo(-12, -5);
      context.lineTo(-12 - flame, 0);
      context.lineTo(-12, 5);
      context.closePath();
      context.fill();
      context.restore();
    }
    if (player.shield) {
      context.save();
      context.strokeStyle = 'rgba(87, 230, 255, 0.85)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius + 10 + 2 * Math.sin(time * 5), 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  function drawHud(state, muted) {
    const player = state.player;
    context.textBaseline = 'alphabetic';
    // Hull, top-left.
    text('HULL', 24, 34, 15, PALETTE.textDim, 'left', 700);
    bar(24, 44, 220, 16, player.hull / PLAYER.hull, player.hull > 30 ? '#7dffb2' : '#ff5d73', 'rgba(234, 242, 255, 0.16)');
    context.strokeStyle = 'rgba(234, 242, 255, 0.35)';
    context.lineWidth = 1;
    context.strokeRect(24, 44, 220, 16);
    text(`${Math.ceil(player.hull)}`, 252, 59, 15, PALETTE.text, 'left', 600);
    if (player.shield) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.moveTo(304, 44);
      context.lineTo(312, 52);
      context.lineTo(304, 60);
      context.lineTo(296, 52);
      context.closePath();
      context.fill();
      text('SHIELD', 318, 59, 13, PALETTE.player, 'left', 700);
    }
    // Beacon charge, top-centre.
    const chargeLabel = `BEACON ${state.charge}/${CHARGE_GOAL}`;
    text(chargeLabel, FIELD.width / 2, 34, 15, PALETTE.textDim, 'center', 700);
    bar(FIELD.width / 2 - 160, 44, 320, 16, state.charge / CHARGE_GOAL, PALETTE.gold, 'rgba(234, 242, 255, 0.16)');
    context.strokeStyle = 'rgba(234, 242, 255, 0.35)';
    context.strokeRect(FIELD.width / 2 - 160, 44, 320, 16);
    // Score, top-right (clear of the mute button).
    text(`SCORE ${state.score}`, FIELD.width - 84, 34, 22, PALETTE.text, 'right', 700);
    text(`BEST ${Math.max(state.best, state.score)}`, FIELD.width - 84, 58, 14, PALETTE.textDim, 'right', 600);
    if (state.comboMult > 1) {
      text(`COMBO x${state.comboMult.toFixed(1)}`, FIELD.width - 84, 82, 20, PALETTE.gold, 'right', 700);
    }
    // Wave, bottom-left.
    const waveName = state.wave > 0 ? WAVE_NAMES[state.wave] : '';
    const remaining = state.spawnQueue.length + state.enemies.length;
    text(`WAVE ${Math.max(1, state.wave)}/${LAST_WAVE} — ${waveName}`, 24, FIELD.height - 44, 16, PALETTE.text, 'left', 600);
    text(state.wavePhase === 'fight' ? `hostiles left: ${remaining}` : 'get ready…', 24, FIELD.height - 22, 14, PALETTE.textDim, 'left');
    // Dash + power-ups, bottom-right.
    const dashReady = player.dashCooldown <= 0;
    text(dashReady ? 'DASH READY [Space]' : 'DASH …', FIELD.width - 24, FIELD.height - 44, 15, dashReady ? PALETTE.player : PALETTE.textDim, 'right', 700);
    bar(FIELD.width - 164, FIELD.height - 36, 140, 8, dashReady ? 1 : 1 - player.dashCooldown / PLAYER.dashCooldown, PALETTE.player, 'rgba(234, 242, 255, 0.16)');
    let powerLine = '';
    if (player.overchargeTimer > 0) powerLine += `OVERCHARGE ${Math.ceil(player.overchargeTimer)}s  `;
    if (player.magnetTimer > 0) powerLine += `MAGNET ${Math.ceil(player.magnetTimer)}s`;
    if (powerLine) text(powerLine, FIELD.width - 24, FIELD.height - 66, 14, '#7dffb2', 'right', 600);
    if (muted) text('MUTED [M]', FIELD.width - 24, 82, 13, PALETTE.textDim, 'right');
  }

  function drawBanner(state) {
    if (state.wavePhase !== 'banner' || state.wave === 0) return;
    const title = state.bonusRounds > 0 ? `EMBER ROUND ${state.bonusRounds}` : `WAVE ${state.wave}`;
    const name = state.bonusRounds > 0 ? 'The Reef still hides light — keep gathering' : WAVE_NAMES[state.wave];
    const alpha = Math.min(1, state.bannerTimer > 0.4 ? (2.4 - state.bannerTimer) * 2 : state.bannerTimer * 2.5);
    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, alpha));
    text(title, FIELD.width / 2, 250, 54, PALETTE.text, 'center', 800);
    text(name, FIELD.width / 2, 292, 22, PALETTE.gold, 'center', 600);
    context.restore();
  }

  function drawField(state, time) {
    context.drawImage(sky, 0, 0);
    // Deterministic shake: offsets from the clock, never Math.random.
    const shakeX = state.shake > 0 ? Math.sin(time * 127.1) * state.shake * 0.5 : 0;
    const shakeY = state.shake > 0 ? Math.cos(time * 149.7) * state.shake * 0.5 : 0;
    context.save();
    context.translate(shakeX, shakeY);
    for (const shard of state.shards) drawShard(shard);
    for (const pickup of state.pickups) drawPickup(pickup, time);
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    for (const orb of state.enemyBolts) {
      context.fillStyle = '#d9b3ff';
      context.shadowColor = '#b388ff';
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    }
    for (const bolt of state.bolts) {
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 3.5;
      context.beginPath();
      context.moveTo(bolt.x - bolt.vx * 0.016, bolt.y - bolt.vy * 0.016);
      context.lineTo(bolt.x, bolt.y);
      context.stroke();
    }
    drawPlayer(state, time);
    for (const particle of state.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.colour;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const floater of state.floaters) {
      context.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      text(floater.text, floater.x, floater.y, 17, floater.colour, 'center', 700);
    }
    context.globalAlpha = 1;
    context.restore();
    // Hurt flash over everything.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 60, 80, ${state.flash * 0.45})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 78;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 16, 38, 0.88)';
    context.strokeStyle = accent;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 16);
    context.fill();
    context.stroke();
    // Long titles shrink to fit the panel instead of touching its border.
    let titleSize = 46;
    context.font = font(titleSize, 800);
    while (titleSize > 28 && context.measureText(title).width > width - 48) {
      titleSize -= 2;
      context.font = font(titleSize, 800);
    }
    context.fillStyle = PALETTE.text;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(title, FIELD.width / 2, y + 74);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 128 + i * 34, 20, PALETTE.textDim, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 20, accent, 'center', 600);
  }

  function drawTitle(state, best, time) {
    drawField(state, time);
    context.fillStyle = 'rgba(11, 16, 38, 0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('LUMEN TIDE', FIELD.width / 2, 150, 84, PALETTE.text, 'center', 800);
    text('Reignite the beacon. Outlast the dark.', FIELD.width / 2, 196, 26, PALETTE.gold, 'center', 600);
    text('You are the keeper of the skiff Lumen, last light of the Shattered Reef.', FIELD.width / 2, 248, 19, PALETTE.textDim, 'center');
    text('Gather 150 shards of light, survive all 10 waves, and the Beacon burns again.', FIELD.width / 2, 276, 19, PALETTE.textDim, 'center');
    text('WASD / arrows — fly      Mouse — aim      Hold click — fire      Space — dash', FIELD.width / 2, 330, 19, PALETTE.text, 'center', 600);
    text('P — pause      M — mute      R — restart', FIELD.width / 2, 360, 19, PALETTE.text, 'center', 600);
    text('A complete game: 10 waves, a beacon to reignite, a way to win, lose and restart.', FIELD.width / 2, 404, 16, PALETTE.textDim, 'center');
    if (best > 0) text(`BEST SCORE  ${best}`, FIELD.width / 2, 448, 20, PALETTE.gold, 'center', 700);
    const start = screenButtons(SCREEN_TITLE)[0];
    const pulse = 0.75 + 0.25 * Math.sin(time * 4);
    context.save();
    context.globalAlpha = pulse;
    button(start, '▶  LAUNCH', PALETTE.player);
    context.restore();
    text('or press Enter', FIELD.width / 2, start.y + start.h + 28, 15, PALETTE.textDim, 'center');
    const mute = screenButtons(SCREEN_TITLE)[1];
    button(mute, '♪', PALETTE.textDim);
  }

  function drawEnd(state, best, victory) {
    drawField(state, state.time);
    context.fillStyle = 'rgba(11, 16, 38, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
    const lines = victory
      ? ['The Beacon burns again. The Reef remembers the light.', `Score ${state.score}   •   Best ${Math.max(best, state.score)}`, `Waves cleared ${state.wave}   •   Foes downed ${state.kills}   •   Accuracy ${accuracy}%`]
      : ['The dark takes the skiff — but the Beacon remembers you.', `Score ${state.score}   •   Best ${Math.max(best, state.score)}`, `Waves cleared ${Math.max(0, state.wave - 1)}   •   Foes downed ${state.kills}   •   Accuracy ${accuracy}%`];
    drawPanel(
      victory ? 'THE BEACON BURNS AGAIN' : 'GAME OVER',
      lines,
      'Press R or click RESTART to sail again',
      victory ? PALETTE.gold : PALETTE.danger,
    );
    const buttons = screenButtons(victory ? SCREEN_VICTORY : SCREEN_OVER);
    button(buttons[0], '↻  RESTART', victory ? PALETTE.gold : PALETTE.danger);
    button(buttons[1], 'MENU', PALETTE.textDim);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.spaceTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, state.time);
      return;
    }
    drawField(state, state.time);
    drawHud(state, muted);
    if (screen === SCREEN_PLAY) {
      drawBanner(state);
    } else if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(11, 16, 38, 0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel('PAUSED', ['The Hollow waits. The Beacon does not.', ''], 'Press P or click RESUME', PALETTE.player);
      const buttons = screenButtons(SCREEN_PAUSED);
      button(buttons[0], 'RESUME', PALETTE.player);
      button(buttons[1], 'RESTART', PALETTE.gold);
      button(buttons[2], '♪', PALETTE.textDim);
    } else if (screen === SCREEN_VICTORY) {
      drawEnd(state, best, true);
    } else if (screen === SCREEN_OVER) {
      drawEnd(state, best, false);
    }
    // The mute button, top-right, on play screens.
    if (screen === SCREEN_PLAY) {
      const mute = screenButtons(SCREEN_PLAY)[0];
      context.globalAlpha = 0.85;
      button(mute, muted ? '✕' : '♪', PALETTE.textDim);
      context.globalAlpha = 1;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

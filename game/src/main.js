// LUMEN TIDE — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, victory and game over.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|victory|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART,
  createInput,
} from './input.js';
import {
  createRenderer, screenButtons, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_VICTORY,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__shotScreen = scene.screen;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashQueued = false;

  // The title screen runs the living Reef behind its panel: wave 1 drifts
  // in, harmless, until the player launches.
  world.reset();
  world.beginWave(1);

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes, each wave and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.startGame();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Gather 150 shards of light and survive all 10 waves.');
  }

  function toTitle() {
    world.reset();
    world.beginWave(1);
    screen = SCREEN_TITLE;
    announce('Lumen Tide. Press Enter or click Launch to start.');
  }

  function finishGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(victory
      ? `Victory. The Beacon burns again. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}. Press R to sail again.`);
  }

  function playEvents(events) {
    for (const event of events) {
      if (event === 'shoot') audio.shoot();
      else if (event === 'enemyShoot') audio.enemyShoot();
      else if (event === 'kill') audio.explosion(false);
      else if (event === 'explode') audio.explosion(true);
      else if (event === 'pickup') audio.pickup(world.state.comboChain);
      else if (event === 'hurt') {
        audio.hurt();
        announce(`Hit. Hull ${Math.ceil(world.state.player.hull)}.`);
      } else if (event === 'shield') audio.click();
      else if (event === 'dash') audio.dash();
      else if (event === 'powerup') audio.powerup();
      else if (event === 'wave') {
        audio.waveHorn();
        if (world.state.wave > 0) announce(`Wave ${world.state.wave}.`);
      } else if (event === 'victory') {
        audio.victory();
        finishGame(true);
      } else if (event === 'over') {
        audio.defeat();
        finishGame(false);
      }
    }
  }

  function hitButton() {
    for (const spec of screenButtons(screen)) {
      if (input.mouse.x >= spec.x && input.mouse.x <= spec.x + spec.w
        && input.mouse.y >= spec.y && input.mouse.y <= spec.y + spec.h) return spec.id;
    }
    return null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (clicked) {
      const hit = hitButton();
      if (hit === 'start' || hit === 'restart') {
        audio.unlock();
        audio.click();
        startGame();
        return;
      }
      if (hit === 'resume') {
        screen = SCREEN_PLAY;
        announce('Playing.');
        return;
      }
      if (hit === 'menu') {
        toTitle();
        return;
      }
      if (hit === 'mute') {
        const muted = audio.toggleMute();
        announce(muted ? 'Muted.' : 'Sound on.');
        return;
      }
    }
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_DASH) dashQueued = true;
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_VICTORY || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_RESTART
      && (screen === SCREEN_VICTORY || screen === SCREEN_OVER || screen === SCREEN_PAUSED)) {
      startGame();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function liveInput() {
    return {
      moveX: input.moveX(),
      moveY: input.moveY(),
      aimX: input.mouse.x,
      aimY: input.mouse.y,
      firing: input.mouse.down,
      dash: dashQueued,
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The skiff's nose follows the pointer over the living Reef.
      world.step({ moveX: 0, moveY: 0, aimX: input.mouse.x, aimY: input.mouse.y, firing: false, dash: false }, STEP, true);
      return;
    }
    const events = world.step(liveInput(), STEP);
    dashQueued = false;
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting the Hollow
  // close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for automated play-tests (and nothing else): the live state
  // and the current screen, read-only from the outside.
  window.__lumen = { state: world.state, screen: () => screen, best: () => best };

  announce('Lumen Tide. Press Enter or click Launch to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

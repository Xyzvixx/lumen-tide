// LUMEN TIDE — all sound is synthesised with WebAudio. No audio files, no
// network, nothing fetched. The context is created lazily on the first user
// gesture (the browser's autoplay rule) and every call is guarded so the
// game plays silently, never throws, when audio is unavailable.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context !== null;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.32;
      master.connect(context.destination);
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone({ frequency, endFrequency, duration, type, volume, when = 0 }) {
    if (!ensure() || muted) return;
    try {
      const start = context.currentTime + when;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
      }
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise({ duration, volume, cutoff }) {
    if (!ensure() || muted) return;
    try {
      const start = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call from any user gesture so the context may start. */
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() { tone({ frequency: 880, endFrequency: 220, duration: 0.09, type: 'square', volume: 0.10 }); },
    enemyShoot() { tone({ frequency: 320, endFrequency: 160, duration: 0.14, type: 'sawtooth', volume: 0.06 }); },
    explosion(big) {
      noise({ duration: big ? 0.5 : 0.28, volume: big ? 0.30 : 0.18, cutoff: big ? 900 : 1400 });
      tone({ frequency: 140, endFrequency: 40, duration: big ? 0.4 : 0.22, type: 'sine', volume: 0.22 });
    },
    pickup(combo) {
      // The chime climbs with the combo chain: progress you can hear.
      const base = 520 * (1 + Math.min(combo, 24) * 0.03);
      tone({ frequency: base, duration: 0.12, type: 'sine', volume: 0.14 });
      tone({ frequency: base * 1.5, duration: 0.16, type: 'sine', volume: 0.10, when: 0.05 });
    },
    hurt() {
      tone({ frequency: 200, endFrequency: 55, duration: 0.25, type: 'sawtooth', volume: 0.22 });
      noise({ duration: 0.18, volume: 0.16, cutoff: 700 });
    },
    dash() { noise({ duration: 0.16, volume: 0.10, cutoff: 3200 }); },
    powerup() {
      tone({ frequency: 440, duration: 0.10, type: 'triangle', volume: 0.14 });
      tone({ frequency: 660, duration: 0.12, type: 'triangle', volume: 0.14, when: 0.08 });
      tone({ frequency: 880, duration: 0.18, type: 'triangle', volume: 0.14, when: 0.16 });
    },
    waveHorn() {
      tone({ frequency: 196, duration: 0.35, type: 'triangle', volume: 0.16 });
      tone({ frequency: 294, duration: 0.45, type: 'triangle', volume: 0.16, when: 0.18 });
    },
    victory() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((frequency, index) => {
        tone({ frequency, duration: 0.35, type: 'triangle', volume: 0.16, when: index * 0.13 });
      });
    },
    defeat() {
      tone({ frequency: 220, endFrequency: 55, duration: 1.1, type: 'sawtooth', volume: 0.18 });
      tone({ frequency: 110, endFrequency: 40, duration: 1.2, type: 'sine', volume: 0.20, when: 0.1 });
    },
    click() { tone({ frequency: 660, duration: 0.06, type: 'sine', volume: 0.10 }); },
  };
}

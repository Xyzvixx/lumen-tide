# lumen-tide

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Xyzvixx/lumen-tide/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Xyzvixx/lumen-tide/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**LUMEN TIDE — Reignite the beacon. Outlast the dark.** A complete original 2D
arena survival shooter that runs entirely offline in a desktop browser. You
are the keeper of the skiff *Lumen*, last light of the Shattered Reef. The
Beacon has gone dark: gather 150 shards of light, survive all 10 waves of the
Hollow — Drifters, Spinners, Mines and the Herald — and reignite it. Hull,
combo, power-ups, dash with invulnerability frames, synthesized WebAudio
sound, and a best score that persists between visits. Original art, sounds
and names — nothing copied from any commercial game.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files (ES
modules, canvas 2D, no library). Node 22+ and a desktop browser required.
`main.ts` hands the game in for make.fun's best-game-01 bounty.

## How to play

- **Objective:** collect 150 light shards (Beacon charge) and clear wave 10
  to win. Lose all hull and the dark takes the skiff.
- **Move:** WASD or arrow keys. **Aim:** mouse. **Fire:** hold left click.
- **Dash:** Space or Shift (brief invulnerability, 1.6 s cooldown).
- **Pause:** P or Esc. **Mute:** M. **Restart:** R on end screens (or the
  on-screen RESTART button).
- **Score:** kills and shards, multiplied by a combo that grows as you chain
  pickups and kills without taking a hit. Pick up Shield Cells, Overcharge
  (rapid fire) and Magnets. Mines explode — shoot them from a safe distance.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ridho-suryo-nugroho&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

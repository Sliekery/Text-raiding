# 👟 RunMon — a tamagotchi for runners

A pocket creature that grows on **your** training. Log the runs and workouts you
actually do, feed it running food, play running mini-games for **◆ stones**, and
watch it evolve down one of two paths.

Open **`runmon/index.html`** in any browser — single file, no dependencies, no
build step. Progress saves to `localStorage`. On iPhone: Share → *Add to Home
Screen* to run it fullscreen.

```
        ✦                       JOGLET
       (◕‿◕)      →   DASHI  →  ZOOMIX  →  BOLTIMUS    ⚡ speed line
      /  👟 \     →   PLODLY →  TREKKA  →  MARATHOR    🥾 endurance line
```

## The loop

| | |
|---|---|
| 📝 **Log** | Manual entry of real sessions. Earns XP, stones, happiness — and makes your RunMon hungry and tired. |
| 🍌 **Feed** | Running fuel restores fed / happy / energy. Some foods nudge a path. |
| 🎮 **Play** | Three mini-games. Each costs ⚡ energy and pays ◆ stones. |
| 🛍️ **Shop** | Stones buy fuel and gear. Gear is drawn onto your RunMon. |
| 📖 **Dex** | Both evolution lines, your speed/endurance balance, and what's still locked. |

Feeding costs stones, stones cost energy, energy comes from food — and XP only
ever comes from training you actually logged.

## Evolution

One starter, **three evolutions**, **two branches**. Every logged session adds
*speed* and *endurance* points; the balance at the first evolution locks the
branch for good (a dead heat lets you choose).

| Stage | Requirement | ⚡ Speed line | 🥾 Endurance line |
|-------|-------------|--------------|-------------------|
| 0 | — | **JOGLET** | **JOGLET** |
| 1 | 350 XP · 3 sessions · 40% happy | **DASHI** | **PLODLY** |
| 2 | 1400 XP · 12 sessions · 50% happy | **ZOOMIX** | **TREKKA** |
| 3 | 3600 XP · 30 sessions · 60% happy | **BOLTIMUS** | **MARATHOR** |

Speedwork (intervals, tempo, hills, strength) drives the speed line. Long runs,
easy miles, walks and cycling drive the endurance line.

## Logging guard rails

Logging is on the honour system, so it comes with caps — nobody logs 100 runs in
a day:

- **4 sessions per day**
- **60 km per day**, max **50 km** in a single entry
- **360 minutes per day**, max **300 min** in a single entry
- **today or yesterday only** — no backfilling a fake month
- **20-second pause** between entries

Caps apply per calendar day, so a day that's full stays full.

## Mini-games

- **🏃 Hurdle Dash** — endless runner, tap to hop hurdles, banked metres become stones.
- **⚡ 100m Sprint** — alternate LEFT/RIGHT (or arrow keys); same button twice trips you up.
- **⏱️ Pace Keeper** — eight reps, stop the needle inside a shrinking pace zone.

## The art

Everything on screen is drawn procedurally into a tiny pixel buffer (a 32-bit
style grid of packed colours) and scaled up with nearest-neighbour, so there are
no image assets at all. A species is a recipe — size, five-colour palette, and
feature flags (`crest`, `fins`, `visor`, `bandana`, `vest`, `wreath`, `cape`,
`bolt`, `aura`, `tail`) — and gear layers on top of the same sprite factory. The
run cycle, blinks and idle bob all come out of one `creatureSprite()` call, so
new forms cost a dozen lines.

## Prototype notes / next up

- Manual logging only. A Strava/Health import would replace the honour system.
- Two branches, seven forms. The chain table (`CHAIN`) takes more without changes.
- Stats decay in real time (hunger ~1%/11 min, happiness ~1%/16 min, energy
  regenerates ~1%/5 min), capped at 3 days of catch-up when you return.

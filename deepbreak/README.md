# ⛏ DEEPBREAK

A small playable demo recreating the game from the r/IndieGaming clip — a
**brick-breaking roguelike mining game**: you fly a pod that *cannot dig*, and
break the cave apart with a bouncing ball instead.

Single file, no dependencies, no build step. Open `index.html` in a browser.

```
DEPTH 82                       NEXT WAVE  ▓▓▓▓░░░░░░  27S   WAVE 3
EXTRACTOR BEAM RANGE 40
OUT OF RANGE                          UPGRADE READY! PRESS U
REQUIRED ────────────
▮ SILVER   BANK 3  CARGO 6  FULL 8
BAND 46-150   DEEPER 139        - - - EXTRACTOR BEAM LIMIT - - -
```

## The loop

1. **Dig.** Launch the ball at the rock. It bounces, chews tiles and pops ore.
   Click again while it is out to **kick** it in a new direction.
2. **Dive.** Silver only exists between **46 m** and **150 m** — below the
   extractor beam limit, marked by the dashed line across the cave.
3. **Haul.** Mined silver rides in your **cargo**, not your bank.
4. **Extract.** Climb back above the beam limit and press **X**. Cargo becomes
   bank; the beam cannot reach you any deeper than that.
5. **Bank 8 silver** to finish the run — while waves of cave drones keep
   spawning on a 45 second timer.

## Controls

| Key | Action |
|-----|--------|
| `LMB` / `W` | Launch the ball toward the cursor — click again to kick it |
| `A` / `D` | Move the pod |
| `↑` / `Shift` | Thrust up · `↓` dive |
| `Space` | Recall the ball |
| `E` | Ping — outlines nearby ore (1 power) |
| `R` | Slam — blasts a hole around you and knocks drones back (3 power) |
| `X` | Extract cargo (only in beam range) |
| `F` | Force the next wave early for +2 power |
| `U` | Take an upgrade when one is ready |

On a phone: **drag to fly the pod, tap to launch/kick**, and use the button row
along the bottom. The HUD switches to a compact layout under 820 px wide.

## Systems

- **Destructible tile world** — 150 × 240 tiles of dirt, rock (3 hits), and
  copper / tin / iron / silver veins, generated from value-noise fbm with
  hollow chambers and three colour strata so depths read differently.
- **Ball physics** — axis-separated stepping with sub-stepping so it never
  tunnels, a 380 px tether that whips it back before it wanders off, constant
  speed, and a little jitter per impact so it can't lock into a loop.
- **Waves** — crawlers that ram you and spitters that keep their distance; the
  ball kills them, `R` knocks them back.
- **Upgrades** — 9 stacking picks (Aftershock Engine, Heavy Core, Twin
  Launcher, Prospector Rig, …), drawn 3 at a time and paid for with the
  supplemental ore you scoop up while digging.
- **Power** — a shared cell bank for slam/ping that trickles back over time.

## Recreated from the clip

The reference is a ~6 second screen recording of a Reddit post by
u/mattmirrorfish on r/IndieGaming. Everything here was written from scratch —
no assets or code from that game — matching what was legible on screen: the
HP/POWER readout, `DEPTH` + `EXTRACTOR BEAM RANGE` + `IN RANGE` block, the
`REQUIRED / SILVER / BANK / EXTRACT / FULL` panel with its depth band, the
`SUPPLEMENTAL` ore tally, the `NEXT WAVE` timer, the dashed **EXTRACTOR BEAM
LIMIT** line, the `UPGRADE READY! PRESS U` banner, the upgrade card with its
stack pips, the comic-book hit text, and the `A/D MOVE … R SLAM` key strip.
Numbers are scaled down so a run lasts a few minutes instead of an evening.

## Poking at it

`window.DEEPBREAK` exposes a few debug helpers used while building this:
`start()`, `warp(depth)`, `give(n)`, `upgrade()`, `stats`, `depth`, `tile(x,y)`.

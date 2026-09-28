# 🚽⚔️ Shasuo: Last Flush

A tiny three.js reaction game. You are **Shasuo** — Yasuo, but with a toilet for a
head. **Malphite** (a very solid 💩) hides in the brush and randomly
*Unstoppable Force*s the enemy caster wave into the air. Cast your ult,
**LAST FLUSH**, the instant they're knocked up.

## Play

Single self-contained file: [`index.html`](index.html). It loads three.js from a
CDN, so it needs internet the first time.

- **Phone:** open it in Safari/Chrome and tap anywhere (or the big 🚽 R button).
  *Share → Add to Home Screen* makes it launch full-screen.
- **Desktop:** press **R** or **Space**.

Quick link (renders straight from this branch):
`https://raw.githack.com/Sliekery/Text-raiding/claude/shasuo-reaction-game-drfoud/shasuo/index.html`

Or with GitHub Pages enabled on the repo: `https://sliekery.github.io/Text-raiding/shasuo/`.

## The cast (all assets are generated in code — no image or model files)

- **Shasuo** — Yasuo's wide hakama, red sash, rope strap, bandaged sword arm,
  layered shoulder pauldron and a curved katana… with a porcelain toilet for a
  head. Angry googly eyes and the nose scar live on the bowl, his spiky hair
  erupts from the tank, the open seat lid flaps like a mouth when he shouts,
  the bowl water spins when he flushes, his ponytail is a streaming ribbon of
  toilet paper off a roll, and he wears a plunger at the hip like a scabbard.
- **Malphite** — a lumpy, rock-textured soft-serve 💩 swirl studded with
  glowing ore crystals, with giant boulder fists, a boulder unibrow, a
  gap-toothed grin, orbiting flies and rising stink lines. He glows orange
  when he winds up Unstoppable Force.
- **Caster minions** — hooded red-side casters with glowing eyes in a void
  face, floating orb staves and League-style health bars.

**Look:** cel-shaded toon materials with ink outlines, real-time shadows, a
hand-painted procedural lane with cobblestones and flowers, thousands of
wind-swept grass blades, tall Rift brush, an enemy turret, drifting pollen and
League-style name/health bars. **Last Flush** blinks Shasuo in with wind
crescents and hit-stop, blasts Malphite aside, then flushes the wave down a
whirlpool. Knock-ups crack the ground and throw rock debris.

Low-end phones automatically drop to a lighter quality mode (no shadows, 1×
resolution) if the frame rate dips, so that reaction timing stays fair.

## Rules

| Reaction (from the knock-up) | Grade   | Points |
|------------------------------|---------|--------|
| ≤ 180 ms                     | PERFECT | 1000   |
| ≤ 260 ms                     | GREAT   | 700    |
| ≤ 380 ms                     | GOOD    | 450    |
| before the creeps land       | LATE    | 200    |

- Consecutive hits build a combo multiplier (up to ×2). Every 10-hit combo
  restocks a 🧻 life.
- Tapping **before** the knock-up is a whiff: combo reset + ½ s lockout.
- Missing the knock-up entirely costs a 🧻. Lose all 3 and your team types /ff.
- It gets harder: shorter airtime, faster dashes, **fake-outs** (Malphite
  glows and twitches but doesn't go) and **Flash** ults (blinks in, near-instant
  dash).
- Your final score maps to a rank from Iron to Challenger; best score is saved
  on the device.

Reaction time is measured from the frame the knock-up is drawn to the input
event's timestamp, so it includes your screen/touch latency — just like the
real thing.

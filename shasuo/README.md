# 🚽⚔️ Shasuo: Last Flush

A tiny three.js reaction game. You are **Shasuo** — Yasuo, but with a toilet for a
head. **Malphite** (a very solid 💩) hides in the brush and randomly
*Unstoppable Force*s the enemy caster wave into the air. Cast your ult,
**LAST FLUSH**, the instant they're knocked up.

## Play

Single self-contained file: [`index.html`](index.html). It loads three.js from a
CDN, so it needs internet the first time.

- **Phone:** open it in Safari/Chrome. Tap the left half of the screen to stab (Q), the right half to ult (R).
  *Share → Add to Home Screen* makes it launch full-screen.
- **Desktop:** press **Q** to stab and **R** or **Space** to ult.

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
- Tapping R **before** the knock-up is a whiff: combo reset + ½ s lockout.
- Missing the knock-up entirely costs a 🧻. Lose all 3 and your team types /ff.
- It gets harder: shorter airtime, faster dashes, **fake-outs** (Malphite
  glows and twitches but doesn't go) and **Flash** ults (blinks in, near-instant
  dash).

### Lane pressure and Steel Tempest (Q)

While you watch Malphite, red-side minions march down both sides of the lane
at Shasuo. **Controls:** left half of the screen (or **Q**) is Steel Tempest,
right half (or **R** / Space) is Last Flush.

| | |
|---|---|
| **Steel Tempest (Q)** | Stab that auto-aims at the nearest minion and hits every minion in a 2.8 m line. 0.4 s cooldown; stabbing at nothing is a whiff. Last hits give gold and CS. |
| **Gathering Storm** | Each Q that hits adds a stack (pips above the button). |
| **Whirlwind (Q3)** | At 2 stacks the next Q throws a tornado 9 m up the lane that knocks up and pushes back every minion it passes. |
| **Self-setup (Q3 → R)** | Press R while your tornado has minions airborne to flush them all for bonus gold. |
| **Melee minion** | 1 HP, 50 g. Hits Shasuo for 10 when it reaches him. |
| **Cannon minion** | 3 HP, 150 g, appears from ult #4. Fires from range for 20. |

Shasuo's health bar regenerates after 3 s without taking damage. If it hits
zero he's **slain**: you lose a 🧻 and a burst of wind clears the minions
around him. Minions freeze while Last Flush plays, and a Malphite flush also
takes any minions your whirlwind has in the air.

Reaction time is measured from the frame the knock-up is drawn to the input
event's timestamp, so it includes your screen/touch latency — just like the
real thing.

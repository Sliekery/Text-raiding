# 🔮 Orcs & Apertures

A first-person demo where you are a mage with two very different hands.

**Right hand** — an outstretched index finger that casts *Arcane Shove*, a
concussive bolt that sends orcs flying. **Left hand** — a palm cradling a
portal sigil that cuts apertures into the pale rune-panels of the chamber.

Orcs do not die because you hit them. Orcs die because of **momentum**:
flung into a pillar, dropped from the ceiling, bowled into each other, or —
best of all — walked curiously into a blue aperture and fired out of the
orange one at speed. Speedy thing goes in, speedy thing goes splat.

```
   ╭─────────────╮
   │  ◯ ← blue   │   an orc walks in here
   ╰─────────────╯
   ╭─────────────╮
   │  ◯ ← orange │   …and leaves here, still walking, 12 metres up the corridor
   ╰─────────────╯
```

## Play

Open **`portal-orcs.html`** in any browser — one self-contained file, nothing
to install, no network needed. Or open `index.html` to run it from source.

| Input | Effect |
| --- | --- |
| `W` `A` `S` `D` | walk · `Shift` sprint · `Space` jump |
| Mouse | aim (click to capture the pointer; drag works too) |
| Left click | cast Arcane Shove — **hold to charge** a wider, harder blast |
| Right click | open the aperture glowing in your left palm (it alternates) |
| `Q` / `E` | blue / orange aperture on demand |
| `R` | close both apertures |
| `M` | mute |

Apertures only take on the **pale rune-panels**. Mossy stone refuses the
enchantment — the same rule Portal plays by, in a dungeon.

Scoring rewards physics over damage: a plain splat is worth its base value, a
**portal splat** (killed within three seconds of passing through an aperture)
is worth 2.5×, and every kill inside three seconds of the last one extends a
**chain multiplier**. Charged blasts into a tight group are how you get a ×9.

### On an iPhone or iPad

It plays properly on a phone — hold it **sideways** and the chamber fills the
glass, with the controls drawn on the canvas and inset past the notch and the
home indicator:

| Thumb | Effect |
| --- | --- |
| Left, anywhere | the stick springs up under your thumb — push a little to walk, all the way to sprint |
| Right, drag | turn |
| Right, tap | quick bolt |
| ✦ button | hold to charge Arcane Shove, release to cast |
| ◯ ◯ buttons | open the blue and orange apertures (a gold halo means they are linked) |
| ⌃ button | jump |

Because thumbs aim coarsely, a bolt cast on touch bends onto an orc already
near the crosshair — it will never find one you are not facing.

The chamber renders fewer columns on a phone and drops portal recursion depth
if the frame rate sags, then climbs back when it can. For the best of it, open
the page in Safari and **Share → Add to Home Screen**: launched from the home
screen it runs full-screen with no browser chrome. If you hear nothing, check
the silent switch — iOS routes Web Audio through the ringer.

## How it works

No engine, no assets, no dependencies — every pixel is drawn by canvas paths
at boot and every sound is synthesised by WebAudio on the fly.

| File | What lives there |
| --- | --- |
| `src/world.js` | the chamber grid, the DDA ray marcher, and aperture maths |
| `src/render.js` | the column raycaster, scanline floor/ceiling, portal recursion |
| `src/art.js` | procedural wall textures, orc actors, gibs, and the mage's hands |
| `src/game.js` | ragdolls, orc brains, waves, scoring, HUD, thumb controls |
| `src/audio.js` | every sound effect, synthesised |

**Portal rendering is the real thing, not a texture.** An aperture is an oval
hole in one face of one grid cell, with its own frame: `n` out of the wall,
`t` along it, `up` = +z. The view through it is the *same camera frustum*
rendered from the twin aperture's frame — the transform is
`B ∘ rotate180 ∘ A⁻¹`, which puts the virtual camera behind the twin, looking
out — then clipped to the oval's screen silhouette, computed per column so
occlusion by intervening walls is exact. That recurses two levels deep, which
is why standing between a facing pair gives you the infinite corridor. Each
recursion level owns its own span buffers; sharing them was the first bug.

**Teleporting is the same transform applied to a body.** Position, velocity
and facing all convert through `(n, t, z) → (−n, −t, z)`, so momentum is
preserved exactly. Orcs, gibs, spell bolts and the mage all use one code
path — which is why an orc can be shoved through an aperture mid-ragdoll and
come out still spinning.

Ragdolls are single spheres with restitution and spin: above 7 m/s of impact
they come apart, between 3.6 and 7 they take damage and complain, below that
they get up dizzy and try again. Orc-on-orc collisions transfer momentum, so
one well-placed shove bowls a whole group.

## Building the single file

```bash
node build-artifact.mjs              # → portal-orcs.html (standalone page)
node build-artifact.mjs --artifact   # → artifact.html (body only, for hosting)
```

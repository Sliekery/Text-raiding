# 🔮 Orcs & Apertures

A first-person demo where you are a mage with two very different hands, and
a chamber too wide to defend on foot.

**Right hand** — an outstretched index finger. Tap to cast *Arcane Shove*, a
concussive bolt that sends orcs flying; **hold** and it becomes a **fireball**,
and at full charge, three of them.

**Left hand** — a palm cradling a portal sigil that cuts apertures into the
pale rune-panels of the chamber.

## The job

The horde is not here for you. It is marching on your two **rune fonts**,
*Dawn* and *Vesper*, at opposite corners of a chamber twenty-five metres
across. On foot that is a ten-second walk you do not have. Through a pair of
apertures it is one step — which is the entire point of the apertures, and why
the chamber opens with a pair already cut into the wall behind each font.

Lose both fonts and the chamber goes dark. Shoot an orc and it forgets the font
and comes for you instead, which is sometimes exactly what you want.

## Apertures earn their keep four ways

| | |
| --- | --- |
| **Transit** | one step from Dawn to Vesper. Nothing else covers both. |
| **Banked spells** | a bolt or fireball fired *through* an aperture comes out the other side wider, harder, worth double, and its kills count as portal kills. Bank a fireball around a corner into a crowd you cannot see. |
| **The grinder** | two apertures facing each other. Shove an orc in and it comes out the far side still travelling, goes straight back in, and each pass spits it out faster. Three passes and it comes apart — **SPUN OUT**, worth quadruple. |
| **Their own curiosity** | orcs walk into apertures on purpose. They arrive somewhere they did not expect, badly disoriented, and stand there blinking while you decide what to do about it. |

Orcs that go through and then die within three seconds are **portal splats**,
worth 2.5×. Every kill within three seconds of the last extends a **chain
multiplier**. A fireball into a packed group is how you get a ×9.

## Fire

A fireball ignites everything in its blast and leaves burning ground behind it.
A burning orc stops caring about your fonts entirely: it panics, runs at nearly
double speed on a weaving line, and **sets light to whatever it collides with**.
One fireball into the middle of a wave can take the whole wave, if the orcs are
obliging enough to run into each other. Fire travels through apertures as
happily as anything else.

## Play

Open **`portal-orcs.html`** in any browser — one self-contained file, nothing
to install, no network needed. Or open `index.html` to run it from source.

| Input | Effect |
| --- | --- |
| `W` `A` `S` `D` | walk · `Shift` sprint · `Space` jump |
| Mouse | aim (click to capture the pointer; drag works too) |
| Left click | tap: **Arcane Shove** · hold: **fireball** · full charge: three fireballs |
| Right click | open the aperture glowing in your left palm (it alternates) |
| `Q` / `E` | blue / orange aperture on demand |
| `R` | close both apertures |
| — | shooting an orc pulls it off the font it was marching on |
| `M` | mute |

Apertures only take on the **pale rune-panels**. Mossy stone refuses the
enchantment — the same rule Portal plays by, in a dungeon.

### On an iPhone or iPad

It plays properly on a phone — hold it **sideways** and the chamber fills the
glass, with the controls drawn on the canvas and inset past the notch and the
home indicator:

| Thumb | Effect |
| --- | --- |
| Left, anywhere | the stick springs up under your thumb — push a little to walk, all the way to sprint |
| Right, drag | turn |
| Right, tap | quick bolt |
| ✦ button | tap for Arcane Shove, hold for a fireball, release to cast |
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
| `src/game.js` | ragdolls, orc brains, fonts, fire, waves, scoring, HUD, thumb controls |
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
one well-placed shove bowls a whole group — and pass fire between the two
bodies, which is why one burning orc in a crowd is a problem for the crowd.

**Aiming, in a renderer with no vertical aim.** Orcs are waist-high and the
spell leaves the hand at chest height, so a flat shot used to sail over every
head in the room. A cast now picks the target nearest the crosshair with a
clear line to it and solves for the vertical velocity that lands on its centre
— including the parabola, for fireballs, which arc. On touch the same target
also bends the shot horizontally, since thumbs aim coarsely; a mouse keeps its
own aim.

## Building the single file

```bash
node build-artifact.mjs              # → portal-orcs.html (standalone page)
node build-artifact.mjs --artifact   # → artifact.html (body only, for hosting)
```

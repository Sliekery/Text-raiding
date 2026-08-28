# 🔫 PolyMe

Upload a photo of yourself, get a **low-poly PlayStation-era character**, and
drop them into a **Madness-style side-on ragdoll shootout**.

Single self-contained `index.html`. No build step, no dependencies, no server —
and **the photo never leaves your device**.

```
  photo -> body landmarks -> proportions -> 204-triangle mesh
                          \-> 128x128 texture atlas, 15-bit
                                    |
                                    v
                     verlet ragdoll  +  PS1 renderer  +  grunts
```

## Play

Open **`polyme/index.html`** in any browser. On a phone: host it (GitHub Pages
works — see [../PLAY_ON_IPHONE.md](../PLAY_ON_IPHONE.md), the URL is just
`/polyme/`) and tap **Share → Add to Home Screen**.

Take or pick a photo, drag seven dots onto your head, chin, shoulders, hips and
feet, hit **Build my character** — then start shooting. Or tap **Skip** for a
stock body.

**Turn the phone sideways.** A side-on shooter wants width, and a portrait
screen simply doesn't have it: at any distance where the character is a
reasonable size, you can only see a few metres across. Portrait works — the
camera pulls back — but you trade character size for seeing what's running at
you. Landscape is much better.

| Control | Touch | Keyboard / mouse |
|---|---|---|
| Move, jump | Left thumb, anywhere — a stick appears where you press; push up to jump | `A`/`D` or `←`/`→`, `W`/`Space` |
| Aim, fire | Right thumb — aims from your chest toward your thumb and fires while held | Mouse to aim, hold click to fire |
| Take a gun | Walk over it | Walk over it |

Pistol, SMG, shotgun, knife and throwing knives. Ammo doesn't reload — when a
gun runs dry you drop to fists, so you fight over what the grunts leave behind.
Three lives, endless waves, and the bodies stay where they fall.

**Everything you do leaves a mark.** Bullets punch holes, knives leave slits,
and a thrown knife *stays in* at the angle it went in at. Wounds are pinned to
the limb that took them, so they ride the body through every stagger and
tumble and are still there on the corpse. Thrown knives that miss stick into
the scenery, and you can walk over and take them back.

⚙️ **FX** exposes the PS1 knobs: internal resolution, vertex jitter, texture
warp, colour depth, fog, outlines, blood, and photo-vs-flat texture.

Your character is saved to the browser, so **Load my last character** brings it
back next time.

## How it works

There is no machine learning here, and that is deliberate: single-photo human
reconstruction is unreliable, but at ~200 triangles and a 128×128 texture,
"unreliable" stops being visible. The PS1 aesthetic is what makes the whole
thing tractable.

**Landmarks.** A cheap silhouette pass models the photo's border as background,
keeps pixels far from it, and reads the row widths to guess head, shoulders,
hips and feet. It's conservative — if the background is busy it declines and
you place the dots yourself.

**Proportions.** Landmark distances become a body in metres. Overall height is
nudged by how many "heads tall" you read as, and every measurement is clamped
to a plausible human range, so dragging a dot somewhere silly bends the
character instead of breaking it.

**Texture.** Photo regions are box-filtered down into a 128×128 atlas: face,
side of head, torso front, an arm strip shoulder-to-hand, a leg strip
hip-to-ankle, plus a gunmetal patch so the weapon costs no extra draw call.
Faces the camera never saw get mirrored, darkened stand-ins. Palette colours
are sampled as the middle 50% by luminance of each patch, so a mouth or a
sliver of background doesn't drag the result off.

**Ragdoll.** 16 verlet particles, distance constraints for the bones, torso
bracing, and min/max separations standing in for elbow and knee limits, all
confined to the z=0 plane. Poses are a soft pull toward animated targets, so a
living fighter and a corpse are one code path with a single gain between them
— that is the whole trick behind the Madness look. Bodies are *always* physics;
"alive" just means something is holding them up.

While alive, that pose is built around a **root** running ordinary platformer
physics — velocity, gravity, ground and platform checks. Movement stays crisp
and responsive while the body still flops, reels from hits and trips over
cover. Shots are 2D raycasts against joint spheres, so headshots hurt more and
crates are real cover; the hit applies an impulse at the joint it landed on
*and* briefly slackens the whole pose, so the body folds around the hit
instead of absorbing it rigidly.

**Wounds** are stored in the local space of the mesh part that took them —
part index, position on that box, entry direction — and the renderer hands
back each part's transform every frame to place them. That is why a hole
stays on the shoulder that was shot rather than hanging in the air where the
shot happened. Only the face toward the camera is drawn; the buried half of a
blade is left to the depth test.

**Renderer.** WebGL1. Bodies are batched by texture — everything wearing your
photo in one draw, every grunt in another — and re-transformed on the CPU each
frame. The PS1 look is structural, not a filter:

- the scene renders into a 224p framebuffer, point-upscaled
- vertices snap to that framebuffer's pixel grid (the wobble)
- UVs are interpolated **affinely**, not perspective-correct (the swim)
- output is quantised to 15-bit with a 4×4 Bayer dither
- vertex lighting only, hard linear fog, `NEAREST` everywhere
- a 9th float per vertex carries a per-body hit flash, so a batched body can
  light up when struck without needing a draw call of its own
- an inverted-hull pass draws black silhouettes behind the bodies, because
  Madness is built out of heavy black linework and the shapes read as mush
  without it

## Known limits

- The back of you is invented — there's only one view in a photo. At this
  fidelity it reads fine, and side-on you rarely see it anyway.
- Loose clothing and hair become body shape.
- Best photo: full body in frame, arms slightly out, plain wall, portrait.
- Busy backgrounds defeat the auto-detect; the dots are the fallback, not a
  formality.
- Grunt AI is deliberately simple: close, take cover behind what's in the way,
  shoot with a reaction delay. It climbs crates and steps off them, but it does
  not flank or coordinate.
- Time dilation on impact fires on kills only. Per-bullet hit-stop sounds
  punchy and is the opposite — hold an SMG on a target and every shot
  re-triggers it, so the whole game crawls while you fire.
- Wounds are capped at 30 per body and blades at 8, oldest dropped first.

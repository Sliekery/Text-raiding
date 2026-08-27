# 🕹️ PolyMe

Upload a photo of yourself and get a **low-poly PlayStation-era character** you
can stand up, make dance, and throw around as a ragdoll.

Single self-contained `index.html`. No build step, no dependencies, no server —
and **the photo never leaves your device**.

```
     photo  ->  body landmarks  ->  proportions  ->  180-triangle mesh
                                 \-> 128x128 texture atlas, 15-bit
                                     |
                                     v
                             verlet ragdoll + PS1 renderer
```

## Play

Open **`polyme/index.html`** in any browser. On a phone: host it (GitHub Pages
works — see [../PLAY_ON_IPHONE.md](../PLAY_ON_IPHONE.md), the URL is just
`/polyme/`) and tap **Share → Add to Home Screen**.

Take or pick a photo, drag seven dots onto your head, chin, shoulders, hips and
feet, and hit **Build my character**. Or tap **Skip** for a stock body.

| Gesture | Does |
|---|---|
| Drag the character | Grab that limb and pull — let go to throw |
| Drag the background | Orbit the camera |
| Pinch / scroll | Zoom |

**STAND / WAVE / DANCE / RAGDOLL** switch pose; **LAUNCH**, **SHOVE**, gravity
and **RESET** do what they say. ⚙️ opens the PS1 FX panel (resolution, vertex
jitter, texture warp, colour depth, fog, photo-vs-flat texture).

Your character is saved to the browser, so **Load my last character** brings it
back next time.

## How it works

There is no machine learning here, and that is deliberate: single-photo human
reconstruction is unreliable, but at 180 triangles and a 128×128 texture,
"unreliable" stops being visible. The PS1 aesthetic is what makes the whole
thing tractable.

**Landmarks.** A cheap silhouette pass models the photo's border as background,
keeps pixels far from it, and reads the row widths to guess head, shoulders,
hips and feet. It's conservative — if the background is busy it declines and
you place the dots yourself. Either way you can drag them.

**Proportions.** Landmark distances become a body in metres. Overall height is
nudged by how many "heads tall" you read as, so builds differ without the camera
framing falling apart, and every measurement is clamped to a plausible human
range so dragging a dot somewhere silly bends the character instead of breaking
it.

**Texture.** Photo regions are box-filtered down into a 128×128 atlas: face,
side of head, torso front, an arm strip running shoulder-to-hand, a leg strip
hip-to-ankle. Faces the camera never saw — the back, the sides — get mirrored
and darkened stand-ins. Palette colours (skin, hair, shirt, trousers, shoes) are
sampled as the middle 50% by luminance of each patch, so a mouth or a sliver of
background doesn't drag the result off. The whole atlas is then punched for
saturation and quantised.

**Rig.** 16 verlet particles, distance constraints for the bones, extra bracing
for the torso, and min/max separations standing in for elbow and knee limits.
Poses are applied as a soft pull toward animated target positions, so *stand*
and *ragdoll* are the same code path with one gain between them — which is why
getting up off the floor looks right rather than snapping.

**Renderer.** WebGL1, ~900 vertices re-transformed on the CPU each frame into
one draw call. The PS1 look is not a filter:

- the scene renders into a 224p framebuffer, point-upscaled
- vertices snap to that framebuffer's pixel grid (the wobble)
- UVs are interpolated **affinely**, not perspective-correct (the swim)
- output is quantised to 15-bit with a 4×4 Bayer dither
- vertex lighting only, hard linear fog, `NEAREST` everywhere

## Known limits

- The back of you is invented — there's only one view in a photo. At this
  fidelity it reads fine.
- Loose clothing and hair become body shape. Also fine at this fidelity.
- Best results: full body in frame, arms slightly out, plain wall, portrait.
- Busy backgrounds defeat the auto-detect; the dots are the fallback, not a
  formality.

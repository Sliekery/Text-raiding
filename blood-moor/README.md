# Blood Moor

A browser homage to Diablo II's first act: the Sorceress, the Rogue Encampment,
the Blood Moor and the Den of Evil. Everything (ground, props, characters,
spells, item art, sound) is generated in code; there are no image or audio files.
The world is drawn at classic low resolution, snapped to a 256-colour palette
with ordered dithering, and scaled up with hard pixels (toggle in the menu).

Open `index.html` through any static web server (or GitHub Pages) and play with
mouse and keyboard or touch.

## What's in it

- **Sorceress with a full skill tree**: 25 skills across Fire, Cold and Lightning,
  unlocked at levels 1, 6, 12, 18, 24 and 30 with prerequisites, synergies,
  masteries and +skill items. Six skill buttons (LMB, RMB, Q, W, E, R).
- **Leveling**: the original experience curve, 5 stat points and 1 skill point
  per level, Strength / Dexterity / Vitality / Energy, life and mana from stats.
- **Loot**: normal, magic, rare and unique items with D2-style affixes, item
  level, requirements, a 10×4 inventory grid with item sizes, paper doll,
  belt with potion columns, stash, gold, magic find and two vendors.
- **One zone**: the Rogue Encampment inside a palisade, the Blood Moor around it
  (dead trees, impaled corpses, a graveyard, ponds, ruins), and the Den of Evil
  cave with Corpsefire. Zombies, Quill Rats, Fallen (who flee), Fallen Shamans
  (who revive them) and Gargantuan Beasts, plus champion packs and random
  uniques with modifiers.
- **Den of Evil quest** from Akara; finishing it unlocks Nightmare, then Hell.
  A new game rebuilds the moor and respawns everything.
- **Town Portal**, automap / minimap, light radius, death and corpse-free respawn.

## Controls

| Action | Mouse & keyboard | Touch |
|---|---|---|
| Move | Left click (hold to keep walking) | Drag anywhere |
| Attack / talk / pick up | Left click the target | Tap the target |
| Cast | Right click (RMB skill), Q W E R | Hold a skill button; drag off it to aim |
| Potions | 1–4 | Tap a belt slot |
| Panels | C character, I inventory, T skills, Tab map | Buttons top right |
| Town Portal | F | Portal button |

Progress saves to the browser.

## Code layout

```
index.html      HUD markup and styles
js/core.js      math, noise, isometric projection, synthesized sound
js/palette.js   256-colour palette, ordered dithering, pixel stone texture
js/data.js      skills, monsters, item bases, affixes, uniques, XP table
js/world.js     map generation, collision, pathfinding, ground painting, automap
js/sprites.js   props, wall blocks, the character skeleton, item icons
js/models.js    3D character models ray-marched on the GPU into 8-direction sprites
js/items.js     item generation, inventory grids, belt, tooltips
js/game.js      player, monster AI, skills, missiles, damage, loot, quests
js/render.js    depth-sorted drawing, spell effects, light radius
js/ui.js        HUD, panels, vendors, input
js/main.js      boot, loop, saving
```

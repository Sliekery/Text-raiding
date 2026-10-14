# Cinder Keep: Undead Burg research notes

Background research for the proof of concept, a recreation of Dark Souls 1 from Firelink Shrine to the Bell Gargoyles. The game itself is in `index.html` and `js/`.

The research covered three areas: map layout, RPG systems, and combat and AI. The wikis (Fextralife, Fandom, Wikidot) were blocked from the build environment. Numbers come from search-result excerpts and from wiki text that people have copied into public GitHub datasets (FuturePress guide figures, a DS1 character planner). Values marked "~" are estimates.

## 1. Route and map layout

The Burg is a **vertical loop**. You climb from the aqueduct stairs through streets and rooftops to a watchtower, cross the Taurus Demon's wall, then cross the drake's bridge. That bridge runs back above the Burg bonfire, so kicking down a ladder joins the two.

| Stop | What happens there | In the PoC |
|---|---|---|
| Firelink Shrine | Bonfire; arcade with Firebomb ×6; stairs up (northeast); the Parish lift arrives here | Lit at the start; 2 dormant hollows; Crestfallen Warrior; lift tower |
| Aqueduct and cliff stairs | Long climb, about 8 m and 6 m | Yes |
| Burg entrance | 2 armored hollows; axe hollow drops from a roof; small bridge; firebomber on a wooden perch; ambush hollow in the house on the left; barrels hide a ledge with a Large Soul | Yes, all of it |
| Yard and archer | 3 hollows; crossbowman on a raised platform; stairs to the walkway | Yes |
| Walkway | Scripted drake fly-by | Yes |
| Undead Burg bonfire | In a yard under the bridge stairwell; ladder up (kicked down later) | Yes, plus 2 spear soldiers in the approach |
| Merchant spur | Crates hide stairs down to the Undead Merchant | Yes, with his DS1 stock and prices |
| Climb | Interior stairs; room with a hollow and a chest (Black Firebombs); 3 hollows; Residence Key door (Gold Pine Resin) | Yes |
| Barrel stairs | A hollow at the top rolls a flaming barrel down | Yes, once per rest |
| Watchtower approach | 3 spear soldiers; firebombers on a high ledge; Black Knight on a lower ledge with the Blue Tearstone Ring | Yes |
| Watchtower | Stairs up to the Taurus fog | Yes, two flights |
| Taurus Demon wall | 4–5 m wide wall; ladder tower on the right with 2 archers; the demon leaps from the far tower when you are a third of the way along; plunge from the ladder tower; one broken gap is a fatal drop | Yes |
| Drake bridge | Solaire's balcony; the drake lands on the gatehouse and sweeps fire along the bridge; alcove and stairs on the right lead down to the shortcut ladder | Yes |
| Parish gate | Portcullis with a lever on the far side; route over the gate tower with a Black Knight; Basement Key on the steps | Yes |
| Forecourt | Armored Tusk (charging boar, armored at the front); Halberd at the top of the stairs | Yes |
| Church | Berenike Knight at the altar; Balder Knights (rapier parry stance); Channeler on the gallery with a hollow pack; bonfire tower with Andre; lift to Firelink | Yes |
| Roof | Fog; long roof with sloped edges; Gargoyle 1 lands a third of the way along; Gargoyle 2 joins at 50% HP; tail cut gives the Tail Axe; afterwards the bell tower opens and you ring the Bell of Awakening | Yes |

Skipped: the Lower Burg, Havel's basement, the crystal lizard, Lautrec and the Sunlight Altar.

## 2. RPG systems (DS1 numbers used in the game)

- **Classes:** all 10, with their DS1 starting level, 8 stats and starting gear. For example, the Knight is level 5 with Vit 14 and a Broadsword and Tower Kite Shield. The Sorcerer starts with Soul Arrow (30 uses), the Pyromancer with Fireball (8) and the Cleric with Heal (5).
- **HP from Vitality** (table): 8→530, 10→572, 14→658, 20→792, 30→1100, 50→1500.
- **Stamina from Endurance** (table): 8→88, 10→91, 15→100, 20→110, 40→160 (cap).
- **Stamina regen:** 45/s, cut sharply while blocking or on a ladder, −20% above 50% equip load.
- **Equip load** = 40 + END.
  - **Rolls:** ≤25% fast, 25–50% mid, 50–100% fat, over 100% none.
  - **I-frames:** all rolls have 11 frames (~0.37 s).
  - **Instability:** the mid and fat rolls have longer recovery with "instability" frames, where you take 1.4× damage.
- **Level cost:** two DS1 formulas, one for levels up to 12 and one for 13+. For example, 673 souls buys level 2 and 1039 souls buys level 13.
- **Weapons:** base damage, Str/Dex scaling letters, requirements and weight. For example, Longsword 80 C/C 10/10 3.0, Dagger 56 E/B crit 130, Halberd 138 C/E 16/12 6.0. Two-handing counts Strength as ×1.5.
- **Shields:** block % and stability. For example, Heater 100%/55, Target 78%/45 with a wide parry window, Plank 75%/45.
- **Estus:** heals 300. You get 5 charges, or 10 at a kindled bonfire, which costs 1 humanity in human form.
- **Humanity:** the item restores all HP and adds +1 humanity.
- **Souls items:** Soul of a Lost Undead 200, Large Soul 400.
- **Consumables:** Firebomb 180 fire, Black Firebomb 300, Throwing Knife 100, Green Blossom +40 stamina/s for 60 s, Gold Pine Resin adds lightning.
- **Enemy HP and souls (FuturePress):**

| Enemy | HP | Souls |
|---|---|---|
| Hollow | 53 | 20 |
| Hollow Warrior | ~150 | ~30 |
| Undead Soldier | 85 | 50 |
| Black Knight | 497 | 800 |
| Balder Knight | 151 | 200 |
| Channeler | 186 | 1,000 |
| Taurus Demon | 1,215 | 3,000 |
| Bell Gargoyles | 999 + 480 | 10,000 |

- **Death:** souls and humanity drop as a bloodstain at your last safe spot. Dying again before you touch it loses them. Resting respawns everything except unique enemies (Black Knights, Channeler, Berenike, the boar, bosses).

## 3. Combat feel and AI

**Commitment**
- Attacks lock you in through wind-up and swing.
- You can only cancel in the last part of recovery, into a roll, block or the next attack.
- A short input buffer (~0.35 s) keeps the newest input.

**Moves**

| Move | How it works |
|---|---|
| Light combo | Loops |
| Heavy | ~1.5× stamina and damage, more poise damage |
| Running attack | Light attack while sprinting |
| Rolling attack | Light attack straight out of a roll |
| Kick | Block + heavy; breaks a raised shield |
| Jump | Tap roll again while sprinting |
| Plunge | Attack while falling; about a third of the Taurus Demon's HP |

**Fall damage**
- None below ~6 m.
- Scales as a share of max HP from 6 to 16 m.
- Death above 16 m.

**Defense**
- **Block:** stability decides the stamina cost; running out breaks your guard.
- **Parry:** a 0.2 s window (0.27 s on small parry shields). It staggers humanoids for a riposte (~4.6× damage).
- **Backstab:** from behind within ~1.3 m (~3.6× damage, scaled by the weapon's crit). Both are invulnerable animations.

**Poise:** armor gives poise and every hit drains it. Hollows stagger on every hit. Knights and bosses take super-armored hits through their attacks.

**Enemy AI**
- **Senses:** a view cone plus a hearing radius (bigger while you sprint), with line-of-sight checks and a short "notice" beat.
- **Pulling:** one enemy pulls its neighbours.
- **Leash:** enemies give up past ~22 m and walk home, which leaves their backs open.
- **Shield users:** turtle at 2–4 m, strafe and lunge.
- **Ranged enemies:** keep their distance and aim with a visible wind-up.
- **Ambushes:** behind doors, droppers on roofs, firebombers on high ground, the barrel trap.

**Bosses**
- **Taurus Demon:**
  - Overhead swing with a variable delay, sweeps, a lunging stab, a standing pound with knockdown, and a jumping pound.
  - It uses the jump when you are far away or up the tower.
  - It can fall through the broken gap in the wall.
- **Bell Gargoyles:**
  - Halberd combos.
  - A tail sweep when you're behind.
  - Unblockable fire breath, used more once the second gargoyle is in.
  - A flying dive.

**Feel**
- A few frames of hit-stop on contact, sparks and blood.
- A dull impact sound.
- Camera shake only for heavy hits.
- A long, interruptible Estus drink that heals late.
- Readable enemy wind-ups, 2–4× the player's.

# ⚔️ Text Raiding

A text-based raid game with retro terminal graphics. You play **one** member of a
10-player raid — the other **9 are AI teammates** — and fight your way through a
4-boss raid, *The Sunken Throne*. Pick a role, learn your class's kit, gear up,
and push from **Normal → Heroic → Mythic**.

```
        __/\__            Voidlord Malach
       ' .  . '           Herald of the End
      - VOID  -
       . LORD .           ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
      - MALACH -            12% HP   ⚠ ENRAGED   ✦ PHASE 2
```

## Play

### 📱 On iPhone / any browser (recommended for mobile)

Open **`index.html`** — a single self-contained web version with big touch
buttons, the same 9 classes, 4 bosses, gearing and difficulty tiers. Nothing to
install; tap **Share → Add to Home Screen** in Safari to play it like a real app.
Progress saves to the browser automatically.

To get it on your phone, host it (e.g. GitHub Pages) and open the URL — see
[PLAY_ON_IPHONE.md](PLAY_ON_IPHONE.md).

### 💻 In a terminal (Python)

```bash
python3 play.py
```

No dependencies — just Python 3.8+. Disable colours with `NO_COLOR=1`, and speed
up message pacing with `TEXTRAID_FAST=1`.

The browser and terminal versions share identical game data and balance.

Your progress (character, gear, cleared bosses) is saved automatically to
`textraid_save.json` in the working directory.

## How it works

Each round you choose **one** action. Watch the `⚠ INCOMING` banner — it
telegraphs the boss's next big move a round early so you can react.

### Roles & classes (3 each)

| Role | Classes | Fantasy |
|------|---------|---------|
| 🛡 **Tank** | Guardian, Crusader, Bramble Warden | Hold the boss's attention (threat), taunt, soak tank-busters with defensive cooldowns. |
| ✚ **Healer** | Cleric, Restoration Druid, Sage | Keep the raid alive: direct heals, heal-over-time, shields, pre-empt raid-wide damage. |
| ⚔ **DPS** | Pyromancer, Assassin, Ranger | Maximise damage, swap to adds, burn the boss before the **enrage timer**. |

Every class has its own resource (Mana / Rage / Energy / Focus) and a unique
5-skill kit inspired by classic MMOs (WoW, FFXIV): burst attacks, DoTs, AoE,
shields, defensives and damage cooldowns, all on resource costs and cooldowns.

### Combat systems

- **Threat / aggro** — the boss attacks whoever holds the most threat. Tanks
  generate huge threat and can **taunt**; if a tank loses aggro, a squishy gets
  flattened.
- **Boss mechanics** — tank-busters, raid-wide AoE, cleaves, add spawns, a
  two-phase final boss, and an **enrage timer** that makes the boss lethal if you
  take too long (a DPS check).
- **Crit & haste** — randomised crits and haste-scaled output add swing to every
  cast.

### Gearing & difficulty

- Six gear slots, each with an **item level**. Killing a boss drops loot; upgrades
  auto-equip and raise your stats (HP, power, crit, haste, defense).
- **Normal → Heroic → Mythic**: each tier raises boss HP & damage, unlocks nastier
  mechanics, and drops higher item-level loot. Clear a tier to unlock the next.
  Higher tiers expect you to gear up and play your role well — Mythic is a true
  knife-edge.

## The raid — *The Sunken Throne*

1. **Gnashtooth the Ravenous** — a warm-up bruiser with a heavy bite.
2. **Hexweaver Sszira** — spider queen who floods the room with adds.
3. **Ironclad Brusk** — brutal tank-buster damage; defensives matter.
4. **Voidlord Malach** — two-phase finale and a real DPS + survival check.

## Also in this repo — 🔶 Tiny Tactics

A **barebones Teamfight Tactics-style auto battler**, proof-of-concept scale, in
a single self-contained file: **[`tft/index.html`](tft/index.html)**. Open it in
any browser — no build, no dependencies, works on a phone.

Buy units from a rotating shop, drop them on a **3D hex board**, and watch the
round fight itself. Drag to orbit the camera, scroll or pinch to zoom. The
pieces a TFT-like needs are all here:

- **Shop & gold economy** — 5-slot shop with level-based rarity odds, 2g rerolls,
  base income + interest (1g per 10g banked, capped at 5) + win/loss streak bonuses.
- **Level & board cap** — buy XP for 4g; your level is how many units you may field.
- **Merging** — 3 copies of a unit become ★★, 3 of those become ★★★ (1.8× stats each).
- **Traits** — 8 traits (Ember, Frost, Shadow, Verdant / Brawler, Ranger, Mage,
  Assassin) counted by *distinct* units, activating at 2 and 4.
- **Auto-battle** — units acquire the nearest enemy over hex distance, walk to it,
  auto-attack to build mana, and cast a unique spell at full mana. Crits, armour
  and magic resist, shields, burns, chills and stuns all resolve on a live tick.
- **Round loop** — PvE minion rounds and scaling PvP boards, health loss based on
  the stage and how many enemies were left standing, and a run that ends at 0 HP.

Positioning matters: melee units want the front row, ranged the back, and
Assassins leap into the enemy back line the moment the fight starts.

### The renderer

The board is drawn in real 3D with a **hand-rolled WebGL renderer** — matrix
maths, shaders, meshes and an orbit camera, all written from scratch so the page
stays a single dependency-free file that works offline. Units are lit meshes with
contact shadows, star tier shows as spikes, and clicking a hex casts a ray from
the camera at the board plane. Health bars, damage numbers and unit labels are
drawn on a 2D overlay canvas so text stays crisp at any zoom.

WebGL is required; the page says so plainly if the browser can't provide it.

## Project layout

```
tft/index.html     Tiny Tactics — the standalone auto-battler (self-contained)
play.py            entry point
textraid/
  data.py          classes, skills, bosses, gear & difficulty tables (all tunable)
  core.py          combat engine: combatants, effects, damage/healing, the boss
  game.py          game flow: raid building, encounter loop, bot AI, gearing, menus
  ui.py            text rendering: colours, HP bars, banners, ASCII art
```

Content is data-driven: add a class, skill, or boss by editing `data.py`.

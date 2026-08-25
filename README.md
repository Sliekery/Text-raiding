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

## Project layout

```
play.py            entry point
textraid/
  data.py          classes, skills, bosses, gear & difficulty tables (all tunable)
  core.py          combat engine: combatants, effects, damage/healing, the boss
  game.py          game flow: raid building, encounter loop, bot AI, gearing, menus
  ui.py            text rendering: colours, HP bars, banners, ASCII art
```

Content is data-driven: add a class, skill, or boss by editing `data.py`.

## Also in this repo

### 🍪 CookieCutter — an iOS sticker app

`CookieCutter/` is a separate, native **SwiftUI app**: pick a cookie cutter
shape, line a photo up under it, and stamp out a die-cut sticker with a white
border and a drop shadow. It ships with an **iMessage sticker pack extension**,
so the stickers you cut appear in the Messages app drawer.

Open `CookieCutter/CookieCutter.xcodeproj` in Xcode 16 on a Mac — the
[CookieCutter README](CookieCutter/README.md) covers signing, the App Group the
extension needs, and how to add your own cutter shape.

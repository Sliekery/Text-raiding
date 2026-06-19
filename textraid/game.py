"""Game flow: raid building, the encounter loop, bot AI, gearing and menus."""

import json
import os
import random
import sys
import time

from . import data
from .core import Boss, Combatant, Effect
from .ui import (C, ROLE_COLOR, banner, boss_art, color, header, hp_bar,
                 resource_bar, rule, term_width)

SAVE_PATH = os.path.join(os.getcwd(), "textraid_save.json")
AUTO = os.environ.get("TEXTRAID_AUTO") == "1"
FAST = AUTO or os.environ.get("TEXTRAID_FAST") == "1"


def say(text="", pause=0.0):
    print(text)
    if pause and not FAST:
        time.sleep(pause)


def beat(t=0.35):
    if not FAST:
        time.sleep(t)


def variance():
    return random.uniform(0.92, 1.08)


# ---------------------------------------------------------------------------
# Output calculation
# ---------------------------------------------------------------------------

def magnitude(caster, mult):
    """Generic power-scaled magnitude with crit/haste/variance applied."""
    amount = caster.power * mult
    amount *= (1 + caster.haste * 0.25)
    amount *= caster.power_mult()
    crit = random.random() < caster.crit
    if crit:
        amount *= 1.5
    return int(amount * variance()), crit


# ---------------------------------------------------------------------------
# Targeting helpers
# ---------------------------------------------------------------------------

def living(seq):
    return [x for x in seq if x.alive]


def primary_enemy(boss, adds):
    live_adds = living(adds)
    if live_adds:
        return min(live_adds, key=lambda a: a.hp)
    return boss if boss.alive else None


def attack_target(caster, boss, adds):
    # Tanks stick to the boss to hold threat; everyone else burns adds first.
    if caster.role == "TANK":
        return boss if boss.alive else primary_enemy(boss, adds)
    return primary_enemy(boss, adds)


def lowest_ally(raid, exclude=None):
    pool = [a for a in living(raid) if a is not exclude]
    if not pool:
        return None
    return min(pool, key=lambda a: a.hp_pct())


def aggro_target(raid, boss):
    if boss.taunt_timer > 0 and boss.taunted_by and boss.taunted_by.alive:
        return boss.taunted_by
    live = living(raid)
    if not live:
        return None
    return max(live, key=lambda a: a.threat)


# ---------------------------------------------------------------------------
# Skill resolution
# ---------------------------------------------------------------------------

def add_threat(caster, raid, amount):
    factor = 2.0 if caster.role == "TANK" else 1.0
    caster.threat += amount * factor


def resolve_skill(caster, skill, raid, boss, adds, log):
    """Execute a skill. ``log`` is a list collecting log lines."""
    if skill.cost:
        caster.resource -= skill.cost
    if skill.cooldown:
        caster.cooldowns[skill.name] = skill.cooldown

    k = skill.kind
    cn = color(caster.name, ROLE_COLOR.get(caster.role, C.WHITE))

    if k in ("attack", "aoe_attack"):
        targets = [boss] + adds if k == "aoe_attack" else [attack_target(caster, boss, adds)]
        total = 0
        crit_any = False
        for t in living(targets):
            amt, crit = magnitude(caster, skill.power)
            dealt = t.take_damage(amt)
            total += dealt
            crit_any = crit_any or crit
            add_threat(caster, raid, dealt * skill.threat)
        ctag = color(" CRIT!", C.BYELLOW, C.BOLD) if crit_any else ""
        scope = "all enemies" if k == "aoe_attack" else "the enemy"
        log.append(f"{cn} uses {color(skill.name, C.BCYAN)} on {scope} for "
                   f"{color(total, C.BRED)} damage.{ctag}")

    elif k == "dot":
        t = attack_target(caster, boss, adds)
        if t:
            t.add_effect(Effect(skill.name, "dot", 0, skill.duration, source=caster,
                                power=skill.power))
            add_threat(caster, raid, caster.power * skill.power * skill.threat)
            log.append(f"{cn} afflicts the enemy with {color(skill.name, C.BMAGENTA)} "
                       f"({skill.duration} rounds).")

    elif k in ("heal", "aoe_heal"):
        if skill.target == "self":
            targets = [caster]
        elif k == "aoe_heal":
            targets = living(raid)
        else:
            t = lowest_ally(raid)
            targets = [t] if t else []
        total = 0
        crit_any = False
        for t in targets:
            amt, crit = magnitude(caster, skill.power)
            total += t.heal(amt)
            crit_any = crit_any or crit
        add_threat(caster, raid, total * 0.15)
        ctag = color(" CRIT!", C.BYELLOW, C.BOLD) if crit_any else ""
        who = "the raid" if k == "aoe_heal" else (
            "themselves" if skill.target == "self" else
            (targets[0].name if targets else "no one"))
        log.append(f"{cn} casts {color(skill.name, C.BGREEN)} on {who} for "
                   f"{color(total, C.BGREEN)} healing.{ctag}")

    elif k == "hot":
        t = caster if skill.target == "self" else lowest_ally(raid)
        if t:
            t.add_effect(Effect(skill.name, "hot", 0, skill.duration, source=caster,
                                power=skill.power))
            log.append(f"{cn} applies {color(skill.name, C.BGREEN)} to "
                       f"{t.name} ({skill.duration} rounds).")

    elif k in ("shield", "aoe_shield"):
        targets = living(raid) if k == "aoe_shield" else [lowest_ally(raid)]
        for t in targets:
            if not t:
                continue
            pool = int(caster.power * skill.power)
            heal_part = 0
            if skill.power and skill.kind == "shield" and skill.name == "Diagnosis":
                heal_part = t.heal(int(caster.power * 0.8))
            t.add_effect(Effect(skill.name, "absorb", pool, skill.duration, source=caster))
        who = "the raid" if k == "aoe_shield" else (targets[0].name if targets and targets[0] else "no one")
        log.append(f"{cn} shields {who} with {color(skill.name, C.BBLUE)}.")

    elif k == "taunt":
        boss.taunted_by = caster
        boss.taunt_timer = 2
        caster.threat = max((a.threat for a in living(raid)), default=0) * 1.5 + 200
        log.append(f"{cn} {color(skill.name, C.BBLUE)}s — the boss turns to face them!")

    elif k == "defensive":
        caster.add_effect(Effect(skill.name, "dr", skill.value, skill.duration))
        log.append(f"{cn} braces with {color(skill.name, C.BBLUE)} "
                   f"(-{int(skill.value*100)}% damage, {skill.duration} rounds).")

    elif k == "buff":
        caster.add_effect(Effect(skill.name, "power", skill.value, skill.duration))
        log.append(f"{cn} empowers with {color(skill.name, C.BYELLOW)} "
                   f"(+{int(skill.value*100)}% damage, {skill.duration} rounds).")


def basic_attack(caster, raid, boss, adds, log):
    t = attack_target(caster, boss, adds)
    if not t:
        return
    amt, crit = magnitude(caster, 0.85)
    dealt = t.take_damage(amt)
    add_threat(caster, raid, dealt)
    if caster.resource_type in ("RAGE", "ENERGY", "FOCUS"):
        caster.gain_resource(15)
    ctag = color(" CRIT!", C.BYELLOW, C.BOLD) if crit else ""
    cn = color(caster.name, ROLE_COLOR.get(caster.role, C.WHITE))
    log.append(f"{cn} attacks for {color(dealt, C.BRED)} damage.{ctag}")


# ---------------------------------------------------------------------------
# Bot AI
# ---------------------------------------------------------------------------

def skill_by_kinds(klass, kinds):
    return [s for s in klass.skills if s.kind in kinds]


def best_affordable(caster, skills):
    usable = [s for s in skills if caster.can_afford(s)]
    if not usable:
        return None
    # Prefer higher power; for buffs/defensives just take the first usable.
    return max(usable, key=lambda s: s.power + (s.value * 3))


def bot_action(actor, raid, boss, adds, incoming, mt):
    """Pick and resolve one action for an AI raid member."""
    log = []
    ks = {s.name: s for s in actor.klass.skills}
    live_adds = living(adds)

    if actor.role == "TANK":
        cur = aggro_target(raid, boss)
        # Emergency self-heal.
        if actor.hp_pct() < 0.4:
            heal = best_affordable(actor, skill_by_kinds(actor.klass, ("heal", "hot")))
            if heal:
                resolve_skill(actor, heal, raid, boss, adds, log)
                return log
        # React to a tank buster aimed at us.
        if incoming and incoming.kind in ("tank_buster", "cleave") and cur is actor:
            dfn = best_affordable(actor, skill_by_kinds(actor.klass, ("defensive",)))
            if dfn:
                resolve_skill(actor, dfn, raid, boss, adds, log)
                return log
        # Main tank grabs aggro if it slips.
        if actor is mt and cur is not actor and boss.taunt_timer <= 0:
            taunt = next((s for s in actor.klass.skills if s.kind == "taunt"
                          and actor.can_afford(s)), None)
            if taunt:
                resolve_skill(actor, taunt, raid, boss, adds, log)
                return log
        # Threat: AoE if adds, else single.
        kinds = ("aoe_attack", "dot") if live_adds else ("attack", "dot")
        atk = best_affordable(actor, skill_by_kinds(actor.klass, kinds))
        if atk:
            resolve_skill(actor, atk, raid, boss, adds, log)
        else:
            basic_attack(actor, raid, boss, adds, log)
        return log

    if actor.role == "HEALER":
        # Pre-empt raid-wide damage.
        if incoming and incoming.kind == "raid_aoe":
            aoe = best_affordable(actor, skill_by_kinds(actor.klass, ("aoe_heal", "aoe_shield")))
            if aoe and min((a.hp_pct() for a in living(raid)), default=1) < 0.9:
                resolve_skill(actor, aoe, raid, boss, adds, log)
                return log
        wounded = [a for a in living(raid) if a.hp_pct() < 0.95]
        lowest = lowest_ally(raid)
        if lowest and lowest.hp_pct() < 0.45:
            big = best_affordable(actor, skill_by_kinds(actor.klass, ("heal",)))
            if big:
                resolve_skill(actor, big, raid, boss, adds, log)
                return log
        if len([a for a in living(raid) if a.hp_pct() < 0.7]) >= 4:
            aoe = best_affordable(actor, skill_by_kinds(actor.klass, ("aoe_heal", "aoe_shield")))
            if aoe:
                resolve_skill(actor, aoe, raid, boss, adds, log)
                return log
        if lowest and lowest.hp_pct() < 0.8:
            heal = best_affordable(actor, skill_by_kinds(actor.klass, ("heal", "hot", "shield")))
            if heal:
                resolve_skill(actor, heal, raid, boss, adds, log)
                return log
        # Nobody hurt — help with damage.
        atk = best_affordable(actor, skill_by_kinds(actor.klass, ("attack", "dot")))
        if atk and actor.resource > actor.max_resource * 0.4:
            resolve_skill(actor, atk, raid, boss, adds, log)
        else:
            basic_attack(actor, raid, boss, adds, log)
        return log

    # DPS
    buff = next((s for s in actor.klass.skills if s.kind == "buff" and actor.can_afford(s)), None)
    if buff and not any(e.etype == "power" for e in actor.effects):
        resolve_skill(actor, buff, raid, boss, adds, log)
        return log
    if len(live_adds) >= 2:
        aoe = best_affordable(actor, skill_by_kinds(actor.klass, ("aoe_attack",)))
        if aoe:
            resolve_skill(actor, aoe, raid, boss, adds, log)
            return log
    target = attack_target(actor, boss, adds)
    # Maintain a dot on the focus target.
    dot = next((s for s in actor.klass.skills if s.kind == "dot" and actor.can_afford(s)), None)
    if dot and target and not any(e.name == dot.name for e in target.effects):
        resolve_skill(actor, dot, raid, boss, adds, log)
        return log
    atk = best_affordable(actor, skill_by_kinds(actor.klass, ("attack",)))
    if atk:
        resolve_skill(actor, atk, raid, boss, adds, log)
    else:
        basic_attack(actor, raid, boss, adds, log)
    return log


# ---------------------------------------------------------------------------
# Player turn
# ---------------------------------------------------------------------------

def read_choice(prompt):
    if AUTO:
        return ""
    try:
        return input(prompt).strip().lower()
    except EOFError:
        say(color("\n  Input closed. Progress saved. Farewell!", C.BCYAN))
        sys.exit(0)


def player_turn(player, raid, boss, adds, incoming):
    if AUTO:
        mt = next((a for a in raid if a.role == "TANK"), None)
        return bot_action(player, raid, boss, adds, incoming, mt)

    while True:
        header(f"YOUR TURN — {player.klass.name} ({player.role})")
        skills = player.klass.skills
        for i, s in enumerate(skills, 1):
            cd = player.cooldowns.get(s.name, 0)
            afford = player.resource >= s.cost
            if cd > 0:
                state = color(f"[CD {cd}]", C.GREY)
            elif not afford:
                state = color("[no res]", C.GREY)
            else:
                state = color("[ready]", C.BGREEN)
            cost = color(f"{s.cost} {player.resource_type}", C.BCYAN) if s.cost else color("free", C.GREY)
            print(f"  {color(str(i), C.BOLD)}. {s.name:<18} {state:<20} {cost}")
            print(f"      {color(s.desc, C.DIM)}")
        print(f"  {color('a', C.BOLD)}. Basic Attack   {color('(free, builds resource)', C.DIM)}")
        print(f"  {color('w', C.BOLD)}. Wait / regen   "
              f"{color('i', C.BOLD)}. Inspect raid   "
              f"{color('?', C.BOLD)}. Help")

        choice = read_choice(color("\n  Action > ", C.BOLD))
        log = []
        if choice == "a":
            basic_attack(player, raid, boss, adds, log)
            return log
        if choice == "w":
            log.append(f"{color(player.name, ROLE_COLOR[player.role])} waits, recovering.")
            player.gain_resource(player.regen)
            return log
        if choice == "i":
            print_raid(raid, boss, adds, detailed=True)
            continue
        if choice in ("?", "h", "help"):
            print_help()
            continue
        if choice.isdigit() and 1 <= int(choice) <= len(skills):
            s = skills[int(choice) - 1]
            if player.cooldowns.get(s.name, 0) > 0:
                say(color("  That skill is on cooldown.", C.BRED)); continue
            if player.resource < s.cost:
                say(color("  Not enough resource.", C.BRED)); continue
            resolve_skill(player, s, raid, boss, adds, log)
            return log
        say(color("  Unknown action. Type a number, 'a', 'w', 'i' or '?'.", C.BRED))


# ---------------------------------------------------------------------------
# Rendering the battlefield
# ---------------------------------------------------------------------------

def status_tags(c):
    tags = []
    for e in c.effects:
        sym = {"dr": "🛡", "absorb": "◊", "hot": "✚", "dot": "☠",
               "power": "⚔", "haste": "»"}.get(e.etype, "•")
        tags.append(color(sym, C.DIM))
    return "".join(tags)


def print_raid(raid, boss, adds, detailed=False):
    header("RAID")
    for c in raid:
        rolecol = ROLE_COLOR.get(c.role, C.WHITE)
        marker = color("➤", C.BYELLOW) if c.is_player else " "
        name = color(f"{c.name}", rolecol)
        cls = color(f"{c.klass.name}", C.DIM)
        if not c.alive:
            line = f" {marker} {name:<22} {color('☠ DEAD', C.BRED)}"
            print(line)
            continue
        bar = hp_bar(c.hp, c.max_hp, 18)
        hp = f"{c.hp:>5}/{c.max_hp:<5}"
        res = ""
        if c.max_resource:
            res = " " + resource_bar(c.resource, c.max_resource, 8)
        print(f" {marker} {name:<22} {bar} {hp}{res} {status_tags(c)}")
        if detailed:
            print(f"      {cls}  PWR {int(c.power)}  CRIT {int(c.crit*100)}%  "
                  f"HASTE {int(c.haste*100)}%  DEF {int(c.defense*100)}%")


def print_boss(boss, adds, incoming, round_no):
    header(f"BOSS — Round {round_no}")
    art = boss_art(boss.name)
    info = [
        color(boss.name, C.BOLD, C.BRED),
        color(boss.bossdef.title, C.DIM),
        "",
        hp_bar(boss.hp, boss.max_hp, 30, good=C.BRED, mid=C.BRED, bad=C.BRED),
        f"{boss.hp:>7}/{boss.max_hp:<7}  ({int(boss.hp_pct()*100)}%)",
    ]
    if boss.enraged:
        info.append(color("⚠ ENRAGED — damage massively increased!", C.BYELLOW, C.BOLD))
    if boss.phase == 2:
        info.append(color("✦ PHASE 2", C.BMAGENTA, C.BOLD))
    pad = max(len(line) for line in art) + 2
    for i in range(max(len(art), len(info))):
        left = art[i] if i < len(art) else ""
        right = info[i] if i < len(info) else ""
        print(" " + color(left.ljust(pad), C.BRED) + right)
    for a in living(adds):
        print("   " + color(f"• {a.name}", C.BYELLOW) + " " +
              hp_bar(a.hp, a.max_hp, 12, good=C.BYELLOW, mid=C.BYELLOW, bad=C.BRED) +
              f" {a.hp}/{a.max_hp}")
    if incoming:
        warn = INCOMING_DESC.get(incoming.kind, incoming.name)
        print()
        print(color(f"  ⚠⚠ INCOMING: {incoming.name} — {warn}", C.BYELLOW, C.BOLD))


INCOMING_DESC = {
    "tank_buster": "huge hit on the tank! (tanks: pop a defensive)",
    "raid_aoe": "raid-wide damage! (healers: AoE heal/shield)",
    "spawn_adds": "adds incoming! (dps: get ready to switch)",
    "cleave": "frontal cleave hits the tank and others!",
}


def print_help():
    header("HOW TO PLAY")
    print("""  You are one member of a 10-player raid; the other 9 are AI allies.
  Defeat all 4 bosses of the raid. Each round you pick ONE action.

  ROLES:
   • TANK  — hold the boss's attention (threat), pop defensives for big hits.
   • HEALER— keep the raid alive; pre-heal/shield before raid-wide damage.
   • DPS   — deal damage, swap to adds, burn the boss before the enrage timer.

  WATCH the ⚠ INCOMING warning — it telegraphs the boss's next big move so
  you can react the round before it lands.

  Resources regenerate each round. Skills have costs and cooldowns.
  Beat the enrage timer or the boss becomes nearly unkillable.""")
    if not AUTO:
        input(color("\n  (press Enter)", C.DIM))


# ---------------------------------------------------------------------------
# Boss mechanic resolution
# ---------------------------------------------------------------------------

def resolve_boss_ability(ab, raid, boss, adds, log):
    mult = boss.dmg_mult()
    if ab.kind == "tank_buster":
        tgt = aggro_target(raid, boss)
        if tgt:
            dealt = tgt.take_damage(ab.value * mult)
            log.append(color(f"  ☠ {ab.name} smashes {tgt.name} for {dealt}!", C.BRED, C.BOLD))
    elif ab.kind == "cleave":
        tgt = aggro_target(raid, boss)
        victims = [tgt] if tgt else []
        others = [a for a in living(raid) if a is not tgt]
        if others:
            victims.append(random.choice(others))
        for v in victims:
            if v:
                v.take_damage(ab.value * mult)
        log.append(color(f"  ☠ {ab.name} cleaves the front line!", C.BRED, C.BOLD))
    elif ab.kind == "raid_aoe":
        total = 0
        for a in living(raid):
            total += a.take_damage(ab.value * mult)
        log.append(color(f"  ☠ {ab.name} hits the whole raid for {total} total!", C.BRED, C.BOLD))
    elif ab.kind == "spawn_adds":
        # Adds scale more gently than the boss so they stay killable on higher tiers.
        add_hp_scale = boss.difficulty.hp_mult ** 0.5
        for i in range(ab.add_count):
            add = Combatant(f"{ab.name.split()[-1]} #{len(adds)+1}", "ADD", is_enemy=True)
            add.max_hp = add.hp = int(ab.add_hp * add_hp_scale)
            add.hit = ab.add_hit * boss.difficulty.dmg_mult
            adds.append(add)
        log.append(color(f"  ☠ {ab.name} — {ab.add_count} adds join the fight!", C.BYELLOW, C.BOLD))


# ---------------------------------------------------------------------------
# The encounter
# ---------------------------------------------------------------------------

def run_encounter(player, raid, bossdef, difficulty, boss_index):
    boss = Boss(bossdef, difficulty)
    boss.taunted_by = None
    boss.taunt_timer = 0
    adds = []
    mt = next((a for a in raid if a.role == "TANK"), raid[0])

    # Reset combat state and seed initial tank threat.
    for c in raid:
        c.hp = c.max_hp
        c.resource = c.max_resource
        c.effects.clear()
        c.cooldowns.clear()
        c.alive = True
        c.threat = 600 if c.role == "TANK" else 0

    banner(f"BOSS {boss_index+1}/4 — {bossdef.name}", bossdef.title)
    say(color("  " + bossdef.intro, C.DIM), 0.6)
    say()

    round_no = 0
    while True:
        round_no += 1
        for c in raid:
            c.tick_round_start()

        incoming = boss.pending
        print_boss(boss, adds, incoming, round_no)
        print_raid(raid, boss, adds)
        say()

        # --- Raid acts (player first, then bots in order) ----------------
        order = [player] + [c for c in raid if c is not player]
        for actor in order:
            if not actor.alive or not boss.alive:
                continue
            if actor is player:
                log = player_turn(player, raid, boss, adds, incoming)
            else:
                log = bot_action(actor, raid, boss, adds, incoming, mt)
            for line in log:
                say("  " + line)
                beat(0.12)
            if not boss.alive and not living(adds):
                break

        adds[:] = [a for a in adds if a.alive]
        if not boss.alive:
            return finish_encounter(True, boss, raid, round_no)

        # --- Boss acts ---------------------------------------------------
        say()
        say(color("  ── The boss acts ──", C.GREY))
        boss_log = []

        if boss.pending:
            resolve_boss_ability(boss.pending, raid, boss, adds, boss_log)
            boss.pending = None

        # Auto-attack + add attacks on current aggro target.
        tgt = aggro_target(raid, boss)
        if tgt:
            dealt = tgt.take_damage(boss.autohit * (2.5 if boss.enraged else 1) *
                                    (1.15 if boss.phase == 2 else 1))
            boss_log.append(f"  {boss.name} strikes {tgt.name} for {color(dealt, C.BRED)}.")
        for a in living(adds):
            at = aggro_target(raid, boss)
            if at:
                a.take_damage(getattr(a, "hit", 200))
        if living(adds):
            boss_log.append(color(f"  Adds batter the raid!", C.BYELLOW))

        # Damage/heal-over-time ticks (dots/hots resolve silently each round).
        for c in raid + [boss] + adds:
            c.tick_effects([])
        # A damage-over-time effect can land the killing blow on the boss.
        if not boss.alive:
            return finish_encounter(True, boss, raid, round_no)

        for line in boss_log:
            say(line)
            beat(0.1)

        # Phase 2 transition.
        if bossdef.phase2_at and boss.phase == 1 and boss.hp_pct() <= bossdef.phase2_at:
            boss.phase = 2
            say()
            say(color("  ✦✦ " + bossdef.phase2_speech, C.BMAGENTA, C.BOLD), 0.6)

        # Advance ability timers / set next telegraph.
        for ab in boss._active_abilities():
            boss.timers[ab.name] -= 1
            if boss.timers[ab.name] <= 0 and boss.pending is None:
                boss.pending = ab
                boss.timers[ab.name] = ab.every

        if boss.taunt_timer > 0:
            boss.taunt_timer -= 1

        # Enrage check.
        if not boss.enraged and round_no >= boss.enrage_round:
            boss.enraged = True
            say()
            say(color(f"  ⚠⚠⚠ {boss.name} ENRAGES! The raid must die fast or fall!",
                      C.BYELLOW, C.BOLD), 0.5)

        # Wipe check.
        if not living(raid):
            return finish_encounter(False, boss, raid, round_no)

        if not AUTO:
            say(color("\n  ── press Enter for next round ──", C.DIM))
            read_choice("")
        say("\n" + rule())


def finish_encounter(victory, boss, raid, round_no):
    say()
    if victory:
        banner("VICTORY!", f"{boss.name} falls in {round_no} rounds.")
        survivors = len(living(raid))
        say(color(f"  {survivors}/10 raiders standing.", C.BGREEN), 0.4)
    else:
        banner("WIPE", f"The raid is defeated on round {round_no}.")
        say(color(f"  {boss.name} stands triumphant at {int(boss.hp_pct()*100)}% health.", C.BRED), 0.4)
    return victory


# ---------------------------------------------------------------------------
# Character & raid construction
# ---------------------------------------------------------------------------

def make_combatant(name, klass, ilvl, is_player=False):
    c = Combatant(name, klass.role, klass)
    base = data.ROLE_BASE[klass.role]
    c.apply_statline(base, data.gear_stats(ilvl))
    c.is_player = is_player
    return c


def build_raid(player_role, player_class, player_name, difficulty, gear_avg):
    raid = []
    used_names = {n: list(v) for n, v in data.BOT_NAMES.items()}
    # Order roles so the player sits first within their role group (MT if tank).
    comp = list(data.RAID_COMP)
    role_counts = {r: comp.count(r) for r in set(comp)}

    # Assign classes to bots, rotating through available class options.
    class_cycle = {r: 0 for r in role_counts}
    player_added = False
    # Build in role order: TANK, HEALER, DPS for nice display.
    ordered = []
    for role in ["TANK", "HEALER", "DPS"]:
        for _ in range(role_counts.get(role, 0)):
            if role == player_role and not player_added:
                raid.append(make_combatant(player_name, player_class, gear_avg, is_player=True))
                player_added = True
            else:
                klass = data.CLASSES[role][class_cycle[role] % len(data.CLASSES[role])]
                class_cycle[role] += 1
                nm = used_names[role].pop(0) if used_names[role] else f"{role.title()}{class_cycle[role]}"
                raid.append(make_combatant(nm, klass, difficulty.bot_ilvl))
    return raid


# ---------------------------------------------------------------------------
# Save / load + gearing
# ---------------------------------------------------------------------------

def default_save():
    return {
        "name": None,
        "role": None,
        "class": None,
        "gear": {slot: 8 for slot in data.GEAR_SLOTS},
        "cleared": {"Normal": [], "Heroic": [], "Mythic": []},
        "kills": 0,
    }


def load_save():
    if os.path.exists(SAVE_PATH):
        try:
            with open(SAVE_PATH) as f:
                s = json.load(f)
            base = default_save()
            base.update(s)
            for slot in data.GEAR_SLOTS:
                base["gear"].setdefault(slot, 8)
            return base
        except Exception:
            pass
    return default_save()


def write_save(save):
    try:
        with open(SAVE_PATH, "w") as f:
            json.dump(save, f, indent=2)
    except Exception:
        pass


def avg_ilvl(gear):
    vals = list(gear.values())
    return sum(vals) / len(vals) if vals else 0


def award_loot(save, difficulty, boss_index):
    base = difficulty.loot_ilvl + boss_index * 2
    drop = base + random.randint(0, 4)
    slot = random.choice(data.GEAR_SLOTS)
    cur = save["gear"][slot]
    header("LOOT")
    if drop > cur:
        save["gear"][slot] = drop
        say(color(f"  ✦ You loot {slot} (ilvl {cur} → {drop})! Equipped.", C.BYELLOW, C.BOLD))
    else:
        say(color(f"  A {slot} (ilvl {drop}) drops, but your {cur} is better. Sharded.", C.DIM))
    say(color(f"  Average item level: {avg_ilvl(save['gear']):.1f}", C.BCYAN))


# ---------------------------------------------------------------------------
# Menus
# ---------------------------------------------------------------------------

def choose_from(title, options, render):
    header(title)
    for i, opt in enumerate(options, 1):
        print(f"  {color(str(i), C.BOLD)}. {render(opt)}")
    while True:
        c = read_choice(color("\n  > ", C.BOLD))
        if AUTO:
            return options[0]
        if c.isdigit() and 1 <= int(c) <= len(options):
            return options[int(c) - 1]
        say(color("  Pick a number from the list.", C.BRED))


def show_class_detail(klass):
    print()
    print(color(f"  {klass.name}", C.BOLD, ROLE_COLOR[klass.role]) +
          color(f"  [{klass.resource}]", C.BCYAN))
    print(color(f"  {klass.flavor}", C.DIM))
    for s in klass.skills:
        cd = f" CD{s.cooldown}" if s.cooldown else ""
        print(f"    • {color(s.name, C.BCYAN):<28} {color(s.desc, C.DIM)}")


def character_setup(save):
    banner("TEXT RAIDING", data.RAID_NAME)
    if save["name"] and save["class"]:
        klass = data.find_class(save["class"])
        say(color(f"  Welcome back, {save['name']} the {save['class']} "
                  f"(ilvl {avg_ilvl(save['gear']):.0f}).", C.BGREEN))
        c = read_choice(color("  Continue this character? [Y/n] ", C.BOLD))
        if c in ("", "y", "yes") or AUTO:
            return save["role"], klass, save["name"]

    role = choose_from("CHOOSE YOUR ROLE",
                       ["TANK", "HEALER", "DPS"],
                       lambda r: f"{color(r, ROLE_COLOR[r])}  " + {
                           "TANK": "soak the boss, hold threat, survive big hits",
                           "HEALER": "keep the raid alive against incoming damage",
                           "DPS": "maximise damage and beat the enrage timer"}[r])

    klasses = data.CLASSES[role]
    header(f"CHOOSE YOUR {role} CLASS")
    for k in klasses:
        show_class_detail(k)
    while True:
        c = read_choice(color("\n  Pick class (1-3) > ", C.BOLD))
        if AUTO:
            klass = klasses[0]; break
        if c.isdigit() and 1 <= int(c) <= len(klasses):
            klass = klasses[int(c) - 1]; break
        say(color("  Pick 1, 2 or 3.", C.BRED))

    name = "Hero"
    if not AUTO:
        n = read_choice(color("  Your character's name > "))
        if n:
            name = n.title()
    save["name"] = name
    save["role"] = role
    save["class"] = klass.name
    write_save(save)
    return role, klass, name


def choose_difficulty(save):
    avail = ["Normal"]
    if save["cleared"]["Normal"]:
        avail.append("Heroic")
    if save["cleared"]["Heroic"]:
        avail.append("Mythic")
    opts = []
    for name, d in data.DIFFICULTIES.items():
        locked = name not in avail
        opts.append((name, d, locked))

    header("CHOOSE DIFFICULTY")
    for i, (name, d, locked) in enumerate(opts, 1):
        cleared = len(save["cleared"][name])
        tag = color(" [LOCKED]", C.GREY) if locked else (
            color(f" [{cleared}/4 cleared]", C.BGREEN) if cleared else "")
        print(f"  {color(str(i), C.BOLD)}. {color(name, C.BMAGENTA)}{tag}")
        print(color(f"      boss hp x{d.hp_mult}, boss dmg x{d.dmg_mult}, "
                    f"loot ilvl {d.loot_ilvl}, allies ilvl {d.bot_ilvl}", C.DIM))
    while True:
        c = read_choice(color("\n  > ", C.BOLD))
        if AUTO:
            return data.DIFFICULTIES.get(os.environ.get("TEXTRAID_DIFF", "Normal"),
                                         data.DIFFICULTIES["Normal"])
        if c.isdigit() and 1 <= int(c) <= len(opts):
            name, d, locked = opts[int(c) - 1]
            if locked:
                say(color("  Clear the previous difficulty first!", C.BRED)); continue
            return d
        say(color("  Pick a number.", C.BRED))


# ---------------------------------------------------------------------------
# Top-level loop
# ---------------------------------------------------------------------------

def play():
    save = load_save()
    if AUTO and os.environ.get("TEXTRAID_ILVL"):
        ilvl = int(os.environ["TEXTRAID_ILVL"])
        save["gear"] = {slot: ilvl for slot in data.GEAR_SLOTS}
    role, klass, name = character_setup(save)

    while True:
        difficulty = choose_difficulty(save)
        gear_avg = avg_ilvl(save["gear"])
        raid = build_raid(role, klass, name, difficulty, gear_avg)
        player = next(c for c in raid if c.is_player)

        banner(f"{data.RAID_NAME} — {difficulty.name}",
               f"{name} the {klass.name}  ·  ilvl {gear_avg:.0f}")
        say(color("  Your raid:", C.BOLD))
        for c in raid:
            tag = color("  (you)", C.BYELLOW) if c.is_player else ""
            say(f"   {color('●', ROLE_COLOR[c.role])} {c.name} — {c.klass.name} "
                f"[{c.role}]{tag}")
        if not AUTO:
            read_choice(color("\n  Press Enter to enter the raid...", C.DIM))

        cleared_this_run = []
        wiped = False
        for idx, bossdef in enumerate(data.BOSSES):
            # Refresh player stats in case gear changed mid-run.
            base = data.ROLE_BASE[klass.role]
            player.apply_statline(base, data.gear_stats(avg_ilvl(save["gear"])))
            victory = run_encounter(player, raid, bossdef, difficulty, idx)
            if victory:
                cleared_this_run.append(bossdef.name)
                if bossdef.name not in save["cleared"][difficulty.name]:
                    save["cleared"][difficulty.name].append(bossdef.name)
                save["kills"] += 1
                award_loot(save, difficulty, idx)
                write_save(save)
                if not AUTO and idx < len(data.BOSSES) - 1:
                    say(color("\n  Press Enter to advance to the next boss...", C.DIM))
                    read_choice("")
            else:
                wiped = True
                break

        say()
        if not wiped:
            banner("RAID CLEARED!", f"{difficulty.name} {data.RAID_NAME} complete!")
            say(color(f"  All 4 bosses down. Total lifetime kills: {save['kills']}.", C.BGREEN))
            nxt = {"Normal": "Heroic", "Heroic": "Mythic"}.get(difficulty.name)
            if nxt:
                say(color(f"  {nxt} difficulty unlocked!", C.BYELLOW, C.BOLD))
        else:
            say(color("  The raid has wiped. Regroup, re-gear, and try again.", C.BRED))

        write_save(save)
        if AUTO:
            break
        again = read_choice(color("\n  Return to difficulty select? [Y/n] ", C.BOLD))
        if again in ("n", "no", "q", "quit"):
            say(color("\n  Thanks for raiding! Your progress is saved.", C.BCYAN))
            break


def main():
    try:
        play()
    except KeyboardInterrupt:
        say(color("\n\n  Raid abandoned. Progress saved. Farewell!", C.BCYAN))
        sys.exit(0)

"""Combat engine: combatants, effects, the boss, and damage/heal resolution."""

import random

from . import data


class Effect:
    """A timed buff or debuff living on a combatant."""

    def __init__(self, name, etype, value, duration, source=None, power=0.0):
        self.name = name
        self.etype = etype       # dr / absorb / hot / dot / power / haste
        self.value = value       # magnitude (fraction for dr/power; absorb pool; per-tick amount)
        self.duration = duration
        self.source = source     # the combatant who applied it (for tick scaling)
        self.power = power        # multiplier captured at apply time (for hot/dot)


class Combatant:
    def __init__(self, name, role, klass=None, is_enemy=False):
        self.name = name
        self.role = role
        self.klass = klass
        self.is_enemy = is_enemy
        self.is_player = False

        self.max_hp = 1
        self.hp = 1
        self.power = 0.0
        self.crit = 0.0
        self.haste = 0.0
        self.defense = 0.0

        self.resource_type = klass.resource if klass else "NONE"
        self.max_resource = klass.max_resource if klass else 0
        self.resource = self.max_resource
        self.regen = klass.regen if klass else 0

        self.cooldowns = {}      # skill name -> rounds remaining
        self.effects = []
        self.threat = 0.0
        self.alive = True

    # -- stat setup ---------------------------------------------------------
    def apply_statline(self, base, gear):
        self.max_hp = int(base["hp"] + gear["hp"])
        self.hp = self.max_hp
        self.power = base["power"] + gear["power"]
        self.crit = min(0.75, base["crit"] + gear["crit"])
        self.haste = min(0.60, base["haste"] + gear["haste"])
        self.defense = min(0.80, base["defense"] + gear["defense"])

    # -- effect helpers -----------------------------------------------------
    def add_effect(self, effect):
        # Refresh a same-named effect rather than stacking infinitely.
        for e in self.effects:
            if e.name == effect.name:
                self.effects.remove(e)
                break
        self.effects.append(effect)

    def dr_fraction(self):
        frac = self.defense
        for e in self.effects:
            if e.etype == "dr":
                frac = 1 - (1 - frac) * (1 - e.value)
        return min(0.90, frac)

    def power_mult(self):
        m = 1.0
        for e in self.effects:
            if e.etype == "power":
                m += e.value
        return m

    def total_absorb(self):
        return sum(e.value for e in self.effects if e.etype == "absorb")

    # -- damage / healing ---------------------------------------------------
    def take_damage(self, amount, mitigable=True):
        if not self.alive:
            return 0
        if mitigable:
            amount *= (1 - self.dr_fraction())
        amount = int(amount)
        # consume absorbs first
        for e in list(self.effects):
            if e.etype == "absorb" and amount > 0:
                used = min(e.value, amount)
                e.value -= used
                amount -= used
                if e.value <= 0:
                    self.effects.remove(e)
        self.hp -= amount
        if self.hp <= 0:
            self.hp = 0
            self.alive = False
        return amount

    def heal(self, amount):
        if not self.alive:
            return 0
        amount = int(amount)
        before = self.hp
        self.hp = min(self.max_hp, self.hp + amount)
        return self.hp - before

    def gain_resource(self, amount):
        self.resource = min(self.max_resource, self.resource + amount)

    def can_afford(self, skill):
        return self.resource >= skill.cost and self.cooldowns.get(skill.name, 0) <= 0

    def tick_round_start(self):
        """Regen resources and decay cooldowns at the start of a round."""
        self.gain_resource(self.regen)
        for k in list(self.cooldowns):
            if self.cooldowns[k] > 0:
                self.cooldowns[k] -= 1

    def tick_effects(self, log):
        """Apply dots/hots and age out expired effects. Returns (dmg, heal)."""
        dmg = healed = 0
        for e in list(self.effects):
            if e.etype == "dot" and self.alive:
                src_power = e.source.power if e.source else 100
                amt = self.take_damage(src_power * e.power, mitigable=False)
                dmg += amt
            elif e.etype == "hot" and self.alive:
                src_power = e.source.power if e.source else 100
                amt = self.heal(src_power * e.power)
                healed += amt
            e.duration -= 1
            if e.duration <= 0:
                self.effects.remove(e)
        return dmg, healed

    def hp_pct(self):
        return 0 if self.max_hp <= 0 else self.hp / self.max_hp


class Boss(Combatant):
    def __init__(self, bossdef, difficulty):
        super().__init__(bossdef.name, "BOSS", is_enemy=True)
        self.bossdef = bossdef
        self.difficulty = difficulty
        self.max_hp = int(bossdef.hp * difficulty.hp_mult)
        self.hp = self.max_hp
        self.autohit = bossdef.autohit * difficulty.dmg_mult
        self.enrage_round = bossdef.enrage_round
        self.enraged = False
        self.phase = 1
        self.defense = 0.0
        # ability cooldown timers
        self.timers = {}
        for ab in self._active_abilities():
            self.timers[ab.name] = ab.every
        self.pending = None      # telegraphed ability resolving next round
        self.target = None       # current threat target

    def _active_abilities(self):
        out = []
        for ab in self.bossdef.abilities:
            if ab.heroic_only and not self.difficulty.extra_mechanics:
                continue
            out.append(ab)
        return out

    def dmg_mult(self):
        m = self.difficulty.dmg_mult
        if self.enraged:
            m *= 2.5
        if self.phase == 2:
            m *= 1.15
        return m

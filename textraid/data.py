"""Static game data: classes, skills, bosses, gear and difficulty tables.

Everything here is plain data so the combat engine in :mod:`textraid.core`
stays generic and the content is easy to tweak or extend.
"""

from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
# A skill is described by its ``kind`` which the engine knows how to resolve:
#   attack       single-target damage to current enemy
#   aoe_attack   damage to every enemy
#   dot          damage-over-time debuff on an enemy
#   heal         direct heal on one ally (engine picks lowest)
#   aoe_heal     heal every ally
#   hot          heal-over-time buff on one ally
#   shield       absorb shield on one ally
#   aoe_shield   absorb shield on every ally
#   taunt        force the boss onto the caster + big threat
#   defensive    self damage-reduction buff
#   buff         offensive/utility buff (power or haste) on self/raid
# ---------------------------------------------------------------------------


@dataclass
class Skill:
    name: str
    kind: str
    cost: int = 0                 # resource cost
    cooldown: int = 0             # rounds before reuse
    power: float = 0.0            # multiplier vs caster power (per hit/tick)
    threat: float = 1.0          # threat multiplier on the produced value
    duration: int = 0            # for dot/hot/buff/shield/defensive
    value: float = 0.0           # generic magnitude (DR fraction, buff %, etc.)
    target: str = "enemy"        # enemy / ally / self / raid / allenemies
    desc: str = ""


@dataclass
class ClassDef:
    name: str
    role: str
    flavor: str
    resource: str                # MANA / ENERGY / RAGE / FOCUS
    max_resource: int
    regen: int                   # resource regained per round
    skills: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# TANKS
# ---------------------------------------------------------------------------

GUARDIAN = ClassDef(
    "Guardian", "TANK",
    "A wall of plate and fury who lives in the boss's face.",
    "RAGE", 100, 18,
    [
        Skill("Shield Slam", "attack", cost=15, power=1.4, threat=4.0,
              desc="Bash with your shield for solid damage and heavy threat."),
        Skill("Thunder Clap", "aoe_attack", cost=25, cooldown=2, power=0.7, threat=4.0,
              target="allenemies", desc="Shockwave hitting all enemies, huge AoE threat."),
        Skill("Taunt", "taunt", cost=0, cooldown=3, threat=1.0,
              desc="Force the boss to attack you for 2 rounds."),
        Skill("Shield Wall", "defensive", cost=20, cooldown=6, duration=3, value=0.60,
              target="self", desc="Reduce damage taken by 60% for 3 rounds."),
        Skill("Last Stand", "heal", cost=30, cooldown=8, power=6.0,
              target="self", desc="Steel yourself, healing a large chunk of health."),
    ],
)

CRUSADER = ClassDef(
    "Crusader", "TANK",
    "A holy knight who shields allies and smites with righteous fire.",
    "MANA", 120, 14,
    [
        Skill("Avenger's Shield", "aoe_attack", cost=18, power=1.1, threat=4.0,
              target="allenemies", desc="Hurl a holy shield, damage + threat on all enemies."),
        Skill("Hand of Reckoning", "taunt", cost=0, cooldown=3, threat=1.0,
              desc="Compel the boss to strike you for 2 rounds."),
        Skill("Divine Protection", "defensive", cost=20, cooldown=6, duration=3, value=0.50,
              target="self", desc="A holy ward reduces damage taken by 50% for 3 rounds."),
        Skill("Word of Glory", "heal", cost=30, cooldown=4, power=5.0,
              target="self", desc="Channel holy power into a strong self-heal."),
        Skill("Consecration", "dot", cost=22, cooldown=3, power=0.45, threat=4.0,
              duration=3, desc="Sanctify the ground, burning enemies for 3 rounds."),
    ],
)

WARDEN = ClassDef(
    "Bramble Warden", "TANK",
    "A bear-shaped druid that shrugs off blows and regenerates fiercely.",
    "RAGE", 100, 18,
    [
        Skill("Mangle", "attack", cost=15, power=1.5, threat=4.0,
              desc="Rend the boss for big damage and threat."),
        Skill("Swipe", "aoe_attack", cost=20, cooldown=1, power=0.6, threat=4.0,
              target="allenemies", desc="Claw all nearby enemies for AoE threat."),
        Skill("Growl", "taunt", cost=0, cooldown=3, threat=1.0,
              desc="Roar to force the boss onto you for 2 rounds."),
        Skill("Barkskin", "defensive", cost=15, cooldown=5, duration=3, value=0.45,
              target="self", desc="Thick bark reduces damage taken by 45% for 3 rounds."),
        Skill("Frenzied Regen", "hot", cost=25, cooldown=4, power=1.6, duration=3,
              target="self", desc="Rapidly regenerate health over 3 rounds."),
    ],
)

# ---------------------------------------------------------------------------
# HEALERS
# ---------------------------------------------------------------------------

CLERIC = ClassDef(
    "Cleric", "HEALER",
    "A devout priest of big direct heals and protective shields.",
    "MANA", 1000, 60,
    [
        Skill("Heal", "heal", cost=120, power=2.6, target="ally",
              desc="A strong direct heal on the most wounded ally."),
        Skill("Power Word: Shield", "shield", cost=110, cooldown=2, power=2.2,
              duration=3, target="ally", desc="Absorb shield on an ally for 3 rounds."),
        Skill("Prayer of Healing", "aoe_heal", cost=240, cooldown=2, power=1.3,
              target="raid", desc="Heal the entire raid at once."),
        Skill("Renew", "hot", cost=90, power=0.9, duration=3, target="ally",
              desc="Heal an ally over 3 rounds."),
        Skill("Smite", "attack", cost=60, power=1.4,
              desc="Hurl holy fire at the enemy when healing isn't needed."),
    ],
)

RESTODRUID = ClassDef(
    "Restoration Druid", "HEALER",
    "Nature's hand — a web of heal-over-time spells keeps the raid topped.",
    "MANA", 1000, 60,
    [
        Skill("Regrowth", "heal", cost=140, power=2.2, target="ally",
              desc="A burst heal that also seeds a small regrowth."),
        Skill("Rejuvenation", "hot", cost=90, power=1.0, duration=4, target="ally",
              desc="Powerful heal-over-time on a wounded ally."),
        Skill("Wild Growth", "aoe_heal", cost=230, cooldown=2, power=0.7,
              duration=3, target="raid", desc="Blanket the raid in healing over 3 rounds."),
        Skill("Swiftmend", "heal", cost=130, cooldown=3, power=3.4, target="ally",
              desc="Instant, very strong emergency heal."),
        Skill("Wrath", "attack", cost=60, power=1.3,
              desc="Sling nature damage at the enemy between heals."),
    ],
)

SAGE = ClassDef(
    "Sage", "HEALER",
    "An arcane medic who weaves barriers and damages to heal.",
    "MANA", 1000, 65,
    [
        Skill("Diagnosis", "shield", cost=120, power=1.6, duration=3, target="ally",
              desc="Heal an ally and leave a protective barrier."),
        Skill("Druochole", "heal", cost=150, power=3.0, target="ally",
              desc="Channel aether for a large single-target heal."),
        Skill("Prognosis", "aoe_shield", cost=240, cooldown=3, power=1.0,
              duration=3, target="raid", desc="Shield the entire raid against incoming damage."),
        Skill("Pneuma", "aoe_heal", cost=210, cooldown=4, power=1.1,
              target="raid", desc="A radiant pulse that heals the raid and harms the enemy."),
        Skill("Dosis", "dot", cost=70, power=0.8, duration=3,
              desc="Apply a toxin that damages the enemy over 3 rounds."),
    ],
)

# ---------------------------------------------------------------------------
# DPS
# ---------------------------------------------------------------------------

PYROMANCER = ClassDef(
    "Pyromancer", "DPS",
    "A fire mage of explosive burst and raid-wide infernos.",
    "MANA", 1000, 80,
    [
        Skill("Fireball", "attack", cost=80, power=2.0,
              desc="A reliable bolt of flame."),
        Skill("Pyroblast", "attack", cost=160, cooldown=3, power=4.2,
              desc="A massive, slow-charging fireball."),
        Skill("Fire Blast", "attack", cost=60, cooldown=2, power=1.6,
              desc="Instant flame burst."),
        Skill("Flamestrike", "aoe_attack", cost=180, cooldown=2, power=1.4,
              target="allenemies", desc="Call down fire on all enemies."),
        Skill("Combustion", "buff", cost=40, cooldown=8, duration=3, value=0.50,
              target="self", desc="Ignite for +50% damage for 3 rounds."),
    ],
)

ASSASSIN = ClassDef(
    "Assassin", "DPS",
    "A rogue of bleeds, poisons and brutal finishers.",
    "ENERGY", 100, 25,
    [
        Skill("Sinister Strike", "attack", cost=20, power=1.6,
              desc="A quick, efficient stab."),
        Skill("Rupture", "dot", cost=25, power=0.9, duration=4,
              desc="A deep bleed that ticks for 4 rounds."),
        Skill("Eviscerate", "attack", cost=35, cooldown=2, power=3.6,
              desc="A finishing blow for heavy damage."),
        Skill("Fan of Knives", "aoe_attack", cost=35, cooldown=2, power=1.0,
              target="allenemies", desc="Spray blades at every enemy."),
        Skill("Adrenaline Rush", "buff", cost=0, cooldown=8, duration=3, value=0.40,
              target="self", desc="Surge with +40% damage for 3 rounds."),
    ],
)

RANGER = ClassDef(
    "Ranger", "DPS",
    "A hunter of steady aimed shots, stings and volleys.",
    "FOCUS", 100, 28,
    [
        Skill("Steady Shot", "attack", cost=15, power=1.5,
              desc="A dependable aimed arrow."),
        Skill("Aimed Shot", "attack", cost=35, cooldown=2, power=3.4,
              desc="A slow, devastating precision shot."),
        Skill("Serpent Sting", "dot", cost=20, power=0.8, duration=4,
              desc="A venom that erodes the enemy over 4 rounds."),
        Skill("Multi-Shot", "aoe_attack", cost=30, cooldown=2, power=1.1,
              target="allenemies", desc="Loose arrows at every enemy."),
        Skill("Rapid Fire", "buff", cost=0, cooldown=7, duration=3, value=0.35,
              target="self", desc="Fire faster for +35% damage for 3 rounds."),
    ],
)


CLASSES = {
    "TANK": [GUARDIAN, CRUSADER, WARDEN],
    "HEALER": [CLERIC, RESTODRUID, SAGE],
    "DPS": [PYROMANCER, ASSASSIN, RANGER],
}

ALL_CLASSES = GUARDIAN, CRUSADER, WARDEN, CLERIC, RESTODRUID, SAGE, PYROMANCER, ASSASSIN, RANGER


def find_class(name):
    for c in ALL_CLASSES:
        if c.name == name:
            return c
    return None


# ---------------------------------------------------------------------------
# Base statline per role (before gear)
# ---------------------------------------------------------------------------
# hp, power, crit (0-1), haste (0-1), defense (flat damage-reduction fraction)
ROLE_BASE = {
    "TANK":   dict(hp=3000, power=85,  crit=0.10, haste=0.10, defense=0.40),
    "HEALER": dict(hp=1700, power=110, crit=0.12, haste=0.12, defense=0.0),
    "DPS":    dict(hp=1950, power=130, crit=0.15, haste=0.12, defense=0.0),
}


# ---------------------------------------------------------------------------
# Gear
# ---------------------------------------------------------------------------
GEAR_SLOTS = ["Head", "Chest", "Hands", "Legs", "Weapon", "Trinket"]

# Per point of average item level, a character gains these stats.
GEAR_PER_ILVL = dict(hp=42, power=3.4, crit=0.0016, haste=0.0016, defense=0.0015)


def gear_stats(avg_ilvl):
    return {k: v * avg_ilvl for k, v in GEAR_PER_ILVL.items()}


# ---------------------------------------------------------------------------
# Difficulty tiers
# ---------------------------------------------------------------------------
@dataclass
class Difficulty:
    name: str
    hp_mult: float
    dmg_mult: float
    loot_ilvl: int          # base item level of loot dropped
    bot_ilvl: int           # gear level of your AI raid-mates
    extra_mechanics: bool   # heroic/mythic turn on nastier mechanics


DIFFICULTIES = {
    "Normal": Difficulty("Normal", 1.00, 1.00, loot_ilvl=24, bot_ilvl=16, extra_mechanics=False),
    "Heroic": Difficulty("Heroic", 1.40, 1.28, loot_ilvl=40, bot_ilvl=33, extra_mechanics=True),
    "Mythic": Difficulty("Mythic", 1.85, 1.55, loot_ilvl=56, bot_ilvl=47, extra_mechanics=True),
}


# ---------------------------------------------------------------------------
# Bosses & their scripted abilities
# ---------------------------------------------------------------------------
# A boss ability:
#   name, kind, value, every (round period), telegraph (announce 1 round early)
#   kinds: tank_buster / raid_aoe / spawn_adds / enrage / cleave
@dataclass
class BossAbility:
    name: str
    kind: str
    value: float = 0.0
    every: int = 4
    telegraph: bool = True
    add_hp: float = 0.0
    add_count: int = 0
    add_hit: float = 0.0
    heroic_only: bool = False


@dataclass
class BossDef:
    name: str
    title: str
    hp: float
    autohit: float
    enrage_round: int
    abilities: list
    phase2_at: float = 0.0       # fraction of hp that triggers phase 2 (0 = none)
    phase2_speech: str = ""
    intro: str = ""


BOSSES = [
    BossDef(
        "Gnashtooth the Ravenous", "The Hungering Maw",
        hp=52000, autohit=520, enrage_round=42,
        intro="A hulking beast paces the cavern, drool hissing on the stone.",
        abilities=[
            BossAbility("Crushing Bite", "tank_buster", value=2100, every=4),
            BossAbility("Deafening Roar", "raid_aoe", value=360, every=6),
            BossAbility("Savage Cleave", "cleave", value=900, every=5, heroic_only=True),
        ],
    ),
    BossDef(
        "Hexweaver Sszira", "Mistress of Spiders",
        hp=64000, autohit=480, enrage_round=50,
        intro="Webs blanket the hall. Eight eyes gleam from the dark.",
        abilities=[
            BossAbility("Summon Broodlings", "spawn_adds", every=7,
                        add_hp=3200, add_count=2, add_hit=300),
            BossAbility("Venom Nova", "raid_aoe", value=420, every=5),
            BossAbility("Wrap", "tank_buster", value=1900, every=4),
            BossAbility("Skittering Swarm", "spawn_adds", every=9,
                        add_hp=2600, add_count=3, add_hit=240, heroic_only=True),
        ],
    ),
    BossDef(
        "Ironclad Brusk", "The Unbreakable",
        hp=82000, autohit=560, enrage_round=40,
        intro="A mountain of armour grinds forward, hammer dragging sparks.",
        abilities=[
            BossAbility("Shattering Slam", "tank_buster", value=2700, every=3),
            BossAbility("Quake", "raid_aoe", value=450, every=6),
            BossAbility("Ground Pound", "cleave", value=1100, every=5, heroic_only=True),
        ],
    ),
    BossDef(
        "Voidlord Malach", "Herald of the End",
        hp=76000, autohit=580, enrage_round=50,
        phase2_at=0.5,
        phase2_speech="Malach tears open the sky — 'WITNESS OBLIVION!'",
        intro="Reality buckles. The Voidlord descends, eyes like dead stars.",
        abilities=[
            BossAbility("Void Smash", "tank_buster", value=2600, every=4),
            BossAbility("Entropy", "raid_aoe", value=440, every=5),
            BossAbility("Summon Voidlings", "spawn_adds", every=7,
                        add_hp=3800, add_count=2, add_hit=320),
            BossAbility("Annihilation", "raid_aoe", value=620, every=4, heroic_only=True),
        ],
    ),
]

RAID_NAME = "The Sunken Throne"

# Default raid composition for a 10-player group.
RAID_COMP = ["TANK", "TANK", "HEALER", "HEALER", "HEALER", "DPS", "DPS", "DPS", "DPS", "DPS"]

# Names for AI raid-mates by role.
BOT_NAMES = {
    "TANK": ["Thorgar", "Brannok", "Seraphine", "Durok", "Maelys"],
    "HEALER": ["Liora", "Elenwe", "Father Crane", "Sylune", "Oona"],
    "DPS": ["Vex", "Kaeli", "Rhogar", "Nyssa", "Pip", "Garruk", "Wren", "Talia", "Zed"],
}

"""Text rendering helpers: ANSI colours, HP bars, banners, ASCII art."""

import os
import shutil

# ----------------------------------------------------------------------------
# ANSI colour handling
# ----------------------------------------------------------------------------

_USE_COLOR = os.environ.get("NO_COLOR") is None


class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    GREY = "\033[90m"
    BRED = "\033[91m"
    BGREEN = "\033[92m"
    BYELLOW = "\033[93m"
    BBLUE = "\033[94m"
    BMAGENTA = "\033[95m"
    BCYAN = "\033[96m"


def color(text, *codes):
    if not _USE_COLOR or not codes:
        return text
    return "".join(codes) + str(text) + C.RESET


ROLE_COLOR = {"TANK": C.BBLUE, "HEALER": C.BGREEN, "DPS": C.BRED}


def term_width(default=78):
    try:
        return min(shutil.get_terminal_size().columns, 100)
    except Exception:
        return default


def rule(char="═"):
    return color(char * term_width(), C.GREY)


def hp_bar(cur, mx, width=22, good=C.BGREEN, mid=C.BYELLOW, bad=C.BRED):
    cur = max(0, cur)
    frac = 0.0 if mx <= 0 else cur / mx
    filled = int(round(frac * width))
    filled = max(0, min(width, filled))
    if frac > 0.5:
        col = good
    elif frac > 0.25:
        col = mid
    else:
        col = bad
    return color("█" * filled, col) + color("░" * (width - filled), C.GREY)


def resource_bar(cur, mx, width=12, col=C.BCYAN):
    if mx <= 0:
        return ""
    frac = cur / mx
    filled = int(round(frac * width))
    filled = max(0, min(width, filled))
    return color("▬" * filled, col) + color("▬" * (width - filled), C.GREY)


def banner(title, subtitle=""):
    w = term_width()
    print(color("╔" + "═" * (w - 2) + "╗", C.MAGENTA))
    line = title.center(w - 2)
    print(color("║", C.MAGENTA) + color(line, C.BOLD, C.BMAGENTA) + color("║", C.MAGENTA))
    if subtitle:
        print(color("║", C.MAGENTA) + color(subtitle.center(w - 2), C.DIM) + color("║", C.MAGENTA))
    print(color("╚" + "═" * (w - 2) + "╝", C.MAGENTA))


def header(text):
    print()
    print(color("  ❖ " + text, C.BOLD, C.BCYAN))
    print(rule("─"))


def clearish():
    print("\n" * 2)


# Small per-boss ASCII portraits
BOSS_ART = {
    "Gnashtooth the Ravenous": [
        r"        ,     ,        ",
        r"       (\____/)       ",
        r"        )    (        ",
        r"       =\    /=        ",
        r"         )  (          ",
        r"        /    \   GNASH ",
        r"       |      |        ",
        r"      /        \       ",
        r"      \  VVVV  /       ",
        r"       \______/        ",
    ],
    "Hexweaver Sszira": [
        r"        .-=-.          ",
        r"       /  o o\         ",
        r"      |  \___/ |  ~ssss",
        r"      \  '---' /       ",
        r"     .-`-,___,-`-.     ",
        r"    /   HEXWEAVER  \   ",
        r"    \,_,-~^~-,_,~^~/   ",
    ],
    "Ironclad Brusk": [
        r"      _______         ",
        r"     |[]   []|        ",
        r"     |  IRON |        ",
        r"     | CLAD  |        ",
        r"     |[_____]|        ",
        r"    /| BRUSK |\       ",
        r"   d | _____ | b      ",
    ],
    "Voidlord Malach": [
        r"       __/\__          ",
        r"      ' .  . '         ",
        r"     - VOID  -         ",
        r"      . LORD .         ",
        r"     - MALACH -        ",
        r"      ./ || \.         ",
        r"       /_||_\          ",
    ],
}


def boss_art(name):
    return BOSS_ART.get(name, [r"  .-\"\"\"-.  ", r" /  x x  \ ", r" \  vvv  / ", r"  '-...-'  "])

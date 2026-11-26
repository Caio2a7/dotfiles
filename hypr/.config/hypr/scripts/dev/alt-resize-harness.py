#!/usr/bin/env python3
"""Harness for alt-resize: drives the daemon with a virtual mouse (uinput).

Usage: alt-resize-harness.py <floating-address> <tiled-address>
Restores both windows afterwards. Requires the daemon running.
"""

import json
import os
import subprocess
import sys
import time

from evdev import UInput, ecodes

sys.path.insert(0, os.path.expanduser("~/.config/hypr/scripts"))
from importlib import import_module

window_under = import_module("alt-resize").window_under

LEFT, RIGHT, TOP, BOTTOM = "L", "R", "T", "B"
TRIGGER = os.path.expanduser("~/.config/hypr/scripts/alt-resize-trigger.sh")


def hctl(*args: str) -> str:
    return subprocess.run(["hyprctl", *args], capture_output=True, text=True).stdout


def client(addr: str) -> dict:
    return next(c for c in json.loads(hctl("-j", "clients")) if c["address"] == addr)


def geom(addr: str) -> tuple[int, int, int, int]:
    c = client(addr)
    return (*c["at"], *c["size"])


def put(addr: str, g, floating: bool = True) -> None:
    t = f"address:{addr}"
    if floating:
        hctl("dispatch", "resizewindowpixel", f"exact {g[2]} {g[3]},{t}")
        hctl("dispatch", "movewindowpixel", f"exact {g[0]} {g[1]},{t}")
    else:
        hctl("dispatch", "settiled", t)


def drag(ui, start, delta, steps: int = 12) -> None:
    hctl("dispatch", "movecursor", f"{start[0]} {start[1]}")
    time.sleep(0.15)
    ui.write(ecodes.EV_KEY, ecodes.BTN_LEFT, 1)
    ui.syn()
    subprocess.run([TRIGGER], check=False)
    time.sleep(0.15)
    for i in range(1, steps + 1):
        hctl(
            "dispatch",
            "movecursor",
            f"{start[0] + delta[0] * i // steps} {start[1] + delta[1] * i // steps}",
        )
        time.sleep(0.05)
    time.sleep(0.2)
    ui.write(ecodes.EV_KEY, ecodes.BTN_LEFT, 0)
    ui.syn()
    time.sleep(0.3)


def check(before, after, edges: str, want_fixed: bool = True) -> str:
    """Opposite edges of grabbed ones, and untouched axes, must not move."""
    bx, by, bw, bh = before
    ax, ay, aw, ah = after
    errs = []
    if LEFT in edges and ax + aw != bx + bw:
        errs.append("right edge moved")
    if RIGHT in edges and ax != bx:
        errs.append("left edge moved")
    if TOP in edges and ay + ah != by + bh:
        errs.append("bottom edge moved")
    if BOTTOM in edges and ay != by:
        errs.append("top edge moved")
    if LEFT not in edges and RIGHT not in edges and (ax, aw) != (bx, bw):
        errs.append("x axis changed")
    if TOP not in edges and BOTTOM not in edges and (ay, ah) != (by, bh):
        errs.append("y axis changed")
    return "OK" if not errs else "FAIL: " + ", ".join(errs)


def points(g, inset: int = 5):
    x, y, w, h = g
    xs = {"L": x + inset, "R": x + w - 1 - inset, "": x + w // 2}
    ys = {"T": y + inset, "B": y + h - 1 - inset, "": y + h // 2}
    cases = ["L", "R", "T", "B", "LT", "RT", "LB", "RB"]
    for c in cases:
        cx = xs["L" if "L" in c else "R" if "R" in c else ""]
        cy = ys["T" if "T" in c else "B" if "B" in c else ""]
        yield c, (cx, cy)


def outward(edges: str, d: int) -> tuple[int, int]:
    dx = -d if LEFT in edges else d if RIGHT in edges else 0
    dy = -d if TOP in edges else d if BOTTOM in edges else 0
    return dx, dy


def cases(ui, addr: str, tag: str, orig) -> list:
    rows = []
    for edges, pt in points(orig):
        for label, d in (("out80", 80), ("in30", -30)):
            put(addr, orig)
            time.sleep(0.2)
            before = geom(addr)
            drag(ui, pt, outward(edges, d))
            after = geom(addr)
            rows.append(
                (f"{tag} {edges:2} {label}", before, after, check(before, after, edges))
            )
    put(addr, orig)
    return rows


def main(float_addr: str, tiled_addr: str) -> int:
    orig_f, orig_t = geom(float_addr), geom(tiled_addr)
    fails = 0
    with UInput({ecodes.EV_KEY: [ecodes.BTN_LEFT]}, name="alt-resize-harness") as ui:
        time.sleep(1.0)  # let the daemon discover the new device
        rows = []
        # hit test: points 30px outside LC belong to the tiled window
        x, y, w, h = orig_f
        for name, pt in (
            ("above", (x + w // 2, y - 30)),
            ("left", (x - 30, y + h // 2)),
        ):
            hit = window_under(*pt)
            res = "OK" if hit and hit["address"] == tiled_addr else "FAIL"
            rows.append((f"hit {name} LC+30", orig_f, pt, res))
        hit = window_under(x + w // 2, y + h // 2)
        res = "OK" if hit and hit["address"] == float_addr else "FAIL"
        rows.append(("hit LC interior", orig_f, (x + w // 2, y + h // 2), res))
        # resizable floating window (the tiled one, floated) through all edges
        put(tiled_addr, (1500, 100, 1000, 600))
        hctl("dispatch", "setfloating", f"address:{tiled_addr}")
        put(tiled_addr, (1500, 100, 1000, 600))
        time.sleep(0.5)
        rows += cases(ui, tiled_addr, "float", geom(tiled_addr))
        put(tiled_addr, orig_t, floating=False)
        time.sleep(0.6)
        # tiled regression: right edge + interior
        tx, ty, tw, th = orig_t
        before = geom(tiled_addr)
        drag(ui, (tx + tw - 20, ty + th // 2), (-100, 0))
        after = geom(tiled_addr)
        res = check(before, after, "R")
        fails += res != "OK"
        rows.append(("tiled R in100", before, after, res))
        put(tiled_addr, orig_t, floating=False)
        time.sleep(0.6)
        before = geom(tiled_addr)
        drag(ui, (tx + tw // 2, ty + th // 2), (-100, 60))
        res = (
            "OK"
            if geom(tiled_addr) == before and not client(tiled_addr)["floating"]
            else "FAIL"
        )
        fails += res != "OK"
        rows.append(("tiled interior", before, geom(tiled_addr), res))
    put(tiled_addr, orig_t, floating=False)
    put(float_addr, orig_f)
    fails = sum(r != "OK" for *_, r in rows)
    for name, b, a, r in rows:
        print(f"{name:22} {b!s:28} -> {a!s:28} {r}")
    print("restored:", geom(float_addr), geom(tiled_addr), "fails:", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))

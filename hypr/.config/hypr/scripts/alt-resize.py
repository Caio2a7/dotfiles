#!/usr/bin/env python3
"""ALT + left-drag border resize daemon. Run with --daemon; triggers arrive via FIFO."""

import fcntl, json, math, os, sys, time  # noqa: E401

from alt_resize_input import left_pressed, sync_devices
from alt_resize_ipc import cursor, dispatch, hypr

OUTER = 60  # hit tolerance outside the window rectangle (gaps + reserved bars)
MIN_BAND, BAND_FRAC, MAX_FRAC = 80, 0.15, 0.3  # band: max(80, 15%) capped at 30%
MIN_W, MIN_H, TIMEOUT, TICK, SETTLE = 60, 40, 30.0, 1 / 60, 0.1


def reach(c: dict, cx: int, cy: int) -> tuple[bool, float]:
    (x, y), (w, h) = c["at"], c["size"]
    dx, dy = max(x - cx, cx - (x + w - 1), 0), max(y - cy, cy - (y + h - 1), 0)
    return dx == 0 and dy == 0, math.hypot(dx, dy)


def window_under(cx: int, cy: int) -> dict | None:
    """Topmost window containing the point; else nearest within OUTER."""
    ws = json.loads(hypr("j/activeworkspace"))["id"]
    ranked = []
    for c in json.loads(hypr("j/clients")):
        inside, dist = reach(c, cx, cy)
        if not c["mapped"] or c["hidden"] or c["workspace"]["id"] != ws:
            continue
        if inside or dist <= OUTER:
            z = c["focusHistoryID"]  # smaller = more recently focused = higher
            ranked.append((not inside, not c["floating"], dist, z, c["address"], c))
    return min(ranked, key=lambda r: r[:5])[5] if ranked else None


def side(p: int, lo: int, size: int) -> int:
    """-1 low edge, 1 high edge, 0 interior; outside points grab the nearest side."""
    near_lo, near_hi = p - lo, lo + size - p
    band = min(max(MIN_BAND, BAND_FRAC * size), MAX_FRAC * size)
    if near_lo < band and near_lo <= near_hi:
        return -1
    return 1 if near_hi <= band else 0


def grabbed_edges(win: dict, cx: int, cy: int) -> tuple[bool, bool, bool, bool]:
    (x, y), (w, h) = win["at"], win["size"]
    sx, sy = side(cx, x, w), side(cy, y, h)
    return sx < 0, sx > 0, sy < 0, sy > 0


def target_size(win: dict, edges, dx: int, dy: int) -> tuple[int, int]:
    """Requested size; minimums never exceed the window's original size."""
    (w, h), (left, right, top, bottom) = win["size"], edges
    lo_w, lo_h = min(MIN_W, w), min(MIN_H, h)
    nw = max(lo_w, w - dx) if left else max(lo_w, w + dx) if right else w
    nh = max(lo_h, h - dy) if top else max(lo_h, h + dy) if bottom else h
    return nw, nh


def anchored_pos(win: dict, edges, aw: int, ah: int) -> tuple[int, int]:
    """Position keeping the opposite edge fixed, using the ACTUAL size."""
    (x, y), (w, h), (left, _, top, _) = win["at"], win["size"], edges
    return (x + w - aw if left else x), (y + h - ah if top else y)


def settle(win: dict, edges) -> None:
    """Re-anchor using the size the client actually committed (it may refuse)."""
    cur = next(
        (c for c in json.loads(hypr("j/clients")) if c["address"] == win["address"]),
        None,
    )
    if cur is None:
        return
    x, y = anchored_pos(win, edges, *cur["size"])
    if [x, y] != cur["at"]:
        dispatch([f"movewindowpixel exact {x} {y},address:{win['address']}"])


def apply(win: dict, size, float_first: bool) -> None:
    t = f"address:{win['address']}"
    cmds = ["setfloating " + t] if float_first else []
    dispatch(cmds + [f"resizewindowpixel exact {size[0]} {size[1]},{t}"])


def drag(win: dict, edges, start, devs: dict) -> None:
    last, floated = tuple(win["size"]), win["floating"]
    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline and left_pressed(devs):
        cx, cy = cursor()
        size = target_size(win, edges, cx - start[0], cy - start[1])
        if floated:
            settle(win, edges)  # fix drift from the previous tick's request
        if size != last:
            apply(win, size, not floated)
            last, floated = size, True  # float only on a real drag
        time.sleep(TICK)
    if floated:
        time.sleep(SETTLE)
        settle(win, edges)


def handle_trigger(devs: dict) -> None:
    start = cursor()
    sync_devices(devs)
    win = window_under(*start) if left_pressed(devs) else None
    if win and any(edges := grabbed_edges(win, *start)):
        drag(win, edges, start, devs)


def serve() -> int:
    rt = os.environ["XDG_RUNTIME_DIR"]
    lock = open(f"{rt}/alt-resize.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 0
    fifo = f"{rt}/alt-resize.fifo"
    if os.path.lexists(fifo):
        os.unlink(fifo)
    os.mkfifo(fifo, 0o600)
    fd, devs = os.open(fifo, os.O_RDWR), {}  # RDWR: never blocks, no EOF
    sync_devices(devs)
    while os.read(fd, 4096):
        try:
            handle_trigger(devs)
        except (OSError, ValueError, KeyError, SystemError) as e:
            print(f"alt-resize: {type(e).__name__}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(serve() if "--daemon" in sys.argv else "usage: alt-resize.py --daemon")

"""Pointer-button polling for alt-resize: tracks evdev devices that have BTN_LEFT."""

import sys

import evdev
from evdev import ecodes

IGNORED: set = set()  # event paths without BTN_LEFT


def poll(dev) -> bool | None:
    try:
        return ecodes.BTN_LEFT in dev.active_keys()
    except (OSError, SystemError):
        return None


def sync_devices(devs: dict) -> None:
    current = set(evdev.list_devices())
    IGNORED.intersection_update(current)
    for path in [p for p, d in devs.items() if p not in current or poll(d) is None]:
        devs.pop(path).close()
    for path in current - set(devs) - IGNORED:
        try:
            dev = evdev.InputDevice(path)
        except OSError as e:
            print(f"alt-resize: skip {path}: {e}", file=sys.stderr)
            continue
        if ecodes.BTN_LEFT in dev.capabilities().get(ecodes.EV_KEY, []):
            devs[path] = dev
        else:
            IGNORED.add(path)
            dev.close()


def left_pressed(devs: dict) -> bool:
    return any(poll(d) for d in list(devs.values()))

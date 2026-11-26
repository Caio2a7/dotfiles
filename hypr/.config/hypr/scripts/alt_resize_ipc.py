"""Hyprland IPC helpers for alt-resize."""

import json
import os
import socket
import sys


def hypr(cmd: str) -> str:
    env = os.environ
    path = f"{env['XDG_RUNTIME_DIR']}/hypr/{env['HYPRLAND_INSTANCE_SIGNATURE']}"
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.connect(path + "/.socket.sock")
        s.sendall(cmd.encode())
        return b"".join(iter(lambda: s.recv(65536), b"")).decode()


def cursor() -> tuple[int, int]:
    c = json.loads(hypr("j/cursorpos"))
    return c["x"], c["y"]


def dispatch(cmds: list[str]) -> None:
    reply = hypr("[[BATCH]]" + ";".join("dispatch " + c for c in cmds))
    if "error" in reply.lower():
        print(f"alt-resize: {reply}", file=sys.stderr)

#!/usr/bin/env python3
"""status.py - Unified status dashboard for OpenCode."""

from __future__ import annotations

import os
import subprocess
import sys
from typing import Any, Dict, List, Tuple

sys.path.insert(0, os.path.dirname(__file__))

from aqei.db_reader import OpenCodeDBReader, SessionAnalyzer
from quota_core.sources import fetch_claude_plan_status
from quota_core.detector import detect_active_model

BOLD = "\033[1m"
GREEN = "\033[32m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
MAGENTA = "\033[35m"
RESET = "\033[0m"
DIM = "\033[2m"


def get_git_info() -> Tuple[str, str]:
    """Retrieves current git branch and modified files count."""
    try:
        b_res = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        branch = b_res.stdout.strip() or "detached/unknown"
        s_res = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if s_res.returncode == 0:
            lines = [l for l in s_res.stdout.splitlines() if l.strip()]
            status = "Clean" if not lines else f"{len(lines)} modified file(s)"
            return branch, status
    except Exception:
        pass
    return "N/A", "Not a git repo"


def get_plan_status() -> str:
    """Summarizes the Claude plan limit state from opencode-claude."""
    st = fetch_claude_plan_status()
    if st["status"] != "ok":
        return st["message"]
    return "LIMITED" if st["limited"] else f"{st['state']} ({st.get('window') or 'n/d'})"


def get_last_session_aqei() -> Tuple[str, str, str]:
    """Reads latest OpenCode session and computes AQEI score."""
    try:
        reader = OpenCodeDBReader()
        if not reader.is_available():
            return "N/A", "N/A", "DB unavailable"
        session_id = reader.resolve_session_id("latest")
        if not session_id:
            return "None", "N/A", "No sessions"
        raw_data = reader.fetch_session_data(session_id)
        if not raw_data:
            return session_id[:8], "N/A", "Data unavailable"
        aqei_res = SessionAnalyzer.analyze(raw_data)
        title = raw_data.title or session_id[:8]
        score_label = f"{aqei_res.global_score:.1f}% ({aqei_res.status})"
        return title, score_label, "OK"
    except Exception as e:
        return "N/A", "Error", str(e)


def render_panel(
    model_data: Dict[str, Any],
    plan_status: str,
    git_info: Tuple[str, str],
    session_info: Tuple[str, str, str],
) -> None:
    """Renders ANSI professional status panel."""
    model_id = model_data.get("model_id", "Unknown")
    provider = model_data.get("provider_id", "Unknown")
    variant = model_data.get("variant") or "default"
    branch, git_status = git_info
    sess_title, aqei_score, _ = session_info

    w = 64
    sep = f"{DIM}├{'─' * (w - 2)}┤{RESET}"
    top = f"{DIM}┌{'─' * (w - 2)}┐{RESET}"
    bot = f"{DIM}└{'─' * (w - 2)}┘{RESET}"

    print(top)
    print(
        f"{DIM}│{RESET} {BOLD}{CYAN}OPENCODE UNIFIED SYSTEM STATUS{RESET}"
        f"{' ' * (w - 33)}{DIM}│{RESET}"
    )
    print(sep)
    print(
        f"{DIM}│{RESET}  {BOLD}Active Model:{RESET}    {GREEN}{model_id}{RESET} "
        f"({provider} / {variant})".ljust(w + 9) + f"{DIM}│{RESET}"
    )
    print(
        f"{DIM}│{RESET}  {BOLD}Claude Plan:{RESET}     {GREEN}{plan_status}{RESET}".ljust(w + 9)
        + f"{DIM}│{RESET}"
    )
    print(
        f"{DIM}│{RESET}  {BOLD}Git Context:{RESET}     {YELLOW}{branch}{RESET} "
        f"({git_status})".ljust(w + 9) + f"{DIM}│{RESET}"
    )
    print(
        f"{DIM}│{RESET}  {BOLD}Last Session:{RESET}    {sess_title[:30]}".ljust(w - 2)
        + f"{DIM}│{RESET}"
    )
    print(
        f"{DIM}│{RESET}  {BOLD}Latest AQEI:{RESET}     {MAGENTA}{aqei_score}{RESET}".ljust(
            w + 8
        )
        + f"{DIM}│{RESET}"
    )
    print(bot)


def main() -> None:
    """Main entrypoint for status inspector."""
    active_model = detect_active_model()
    plan_status = get_plan_status()
    git_info = get_git_info()
    session_info = get_last_session_aqei()
    render_panel(active_model, plan_status, git_info, session_info)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""learn.py - Technical insight extractor and Memory MCP integrator."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from typing import Any, Dict, List

MEMORY_FILE = os.path.expanduser("~/.config/opencode/memory.jsonl")


def read_context_file() -> List[str]:
    """Reads .aiflow/context.md if available and extracts insight points."""
    paths = [
        ".aiflow/context.md",
        os.path.expanduser("~/.config/opencode/.aiflow/context.md"),
    ]
    for p in paths:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    lines = [line.strip("- *# \t\r\n") for line in f if line.strip()]
                    return [l for l in lines if len(l) > 10]
            except Exception:
                pass
    return []


def read_git_commits(limit: int = 3) -> List[str]:
    """Reads last git commits messages and subjects."""
    try:
        res = subprocess.run(
            ["git", "log", f"-n{limit}", "--pretty=format:%s (%h)"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if res.returncode == 0 and res.stdout.strip():
            return [l.strip() for l in res.stdout.splitlines() if l.strip()]
    except Exception:
        pass
    return []


def build_entities(
    context_points: List[str], commits: List[str]
) -> List[Dict[str, Any]]:
    """Constructs valid Memory MCP entity dictionaries."""
    entities: List[Dict[str, Any]] = []
    repo_name = os.path.basename(os.getcwd()) or "Global"
    safe_repo = re.sub(r"[^a-zA-Z0-9_]", "_", repo_name)

    if context_points:
        entities.append(
            {
                "type": "entity",
                "name": f"{safe_repo}_Learnings",
                "entityType": "Learnings",
                "observations": context_points[:8],
            }
        )

    if commits:
        entities.append(
            {
                "type": "entity",
                "name": f"{safe_repo}_RecentCommits",
                "entityType": "GitHistory",
                "observations": [f"Commit recente: {c}" for c in commits],
            }
        )

    if not entities and not context_points and not commits:
        entities.append(
            {
                "type": "entity",
                "name": f"{safe_repo}_SessionNote",
                "entityType": "Note",
                "observations": [
                    "Sessão executada sem registros adicionais em .aiflow/context.md"
                ],
            }
        )
    return entities


def save_to_memory(entities: List[Dict[str, Any]]) -> int:
    """Appends entities as JSON lines to memory.jsonl."""
    os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
    count = 0
    with open(MEMORY_FILE, "a", encoding="utf-8") as f:
        for ent in entities:
            f.write(json.dumps(ent, ensure_ascii=False) + "\n")
            count += 1
    return count


def display_summary(entities: List[Dict[str, Any]], saved: bool) -> None:
    """Displays user-friendly ANSI summary of extracted insights."""
    bold = "\033[1m"
    green = "\033[32m"
    cyan = "\033[36m"
    yellow = "\033[33m"
    reset = "\033[0m"

    status_str = (
        f"{green}[SALVO NO GRAFO]{reset}" if saved else f"{yellow}[MODO PREVIEW]{reset}"
    )
    print(f"\n{bold}{cyan}🧠 Memory MCP Insight Extractor{reset} {status_str}")
    print("=" * 60)

    for ent in entities:
        print(f"\n{bold}Entidade:{reset} {ent['name']} ({ent['entityType']})")
        for obs in ent.get("observations", []):
            print(f"  • {obs}")

    print("=" * 60)
    if not saved:
        print(
            f"Execute com {bold}--save{reset} ou {bold}--commit{reset} para persistir em {MEMORY_FILE}.\n"
        )
    else:
        print(f"Persistido com sucesso em {bold}{MEMORY_FILE}{reset}.\n")


def main() -> None:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Extract learnings for Memory MCP")
    parser.add_argument(
        "--save",
        "--commit",
        dest="save",
        action="store_true",
        help="Save to memory.jsonl",
    )
    args, _ = parser.parse_known_args()

    context_points = read_context_file()
    commits = read_git_commits(3)
    entities = build_entities(context_points, commits)

    if args.save:
        save_to_memory(entities)
        display_summary(entities, saved=True)
    else:
        display_summary(entities, saved=False)


if __name__ == "__main__":
    main()

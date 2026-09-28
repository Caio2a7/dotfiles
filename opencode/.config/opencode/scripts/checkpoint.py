#!/usr/bin/env python3
"""checkpoint.py - Session checkpoint snapshot generator and hygiene monitor."""

from __future__ import annotations
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from typing import Any, Dict, List, Tuple

DEFAULT_DB = os.path.expanduser("~/.local/share/opencode/opencode.db")
ALERT_MSG = (
    "\n\033[93m\033[1m⚠️ ALERTA DE HIGIENE DE SESSÃO: 40+ turnos atingidos. "
    "Recomenda-se descarregar o estado com /commit ou /plan e iniciar uma nova sessão limpa via opencode.\033[0m\n"
)


def get_session_stats(db_path: str = "") -> Tuple[str, str, int]:
    path = db_path or DEFAULT_DB
    if not os.path.exists(path):
        return "unknown", "Nenhum banco de dados encontrado", 0
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=3.0)
        with conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, title FROM session ORDER BY time_updated DESC LIMIT 1;"
            )
            row = cur.fetchone()
            if not row:
                return "unknown", "Nenhuma sessão ativa", 0
            s_id, title = row[0], row[1] or "Sem título"
            cur.execute("SELECT COUNT(*) FROM message WHERE session_id = ?;", (s_id,))
            msg_row = cur.fetchone()
            count = msg_row[0] if msg_row else 0
            return s_id, title, count
    except Exception as err:
        return "error", f"Falha ao conectar no DB: {err}", 0


def get_git_state() -> Tuple[str, str]:
    try:
        branch = subprocess.check_output(
            ["git", "branch", "--show-current"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        branch = "unknown"
    try:
        diff_stat = subprocess.check_output(
            ["git", "diff", "--stat"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        diff_stat = ""
    return branch, diff_stat


def parse_plan_tasks() -> Dict[str, List[str]]:
    plan_file = Path(".aiflow/plan.md")
    pending: List[str] = []
    completed: List[str] = []
    if not plan_file.is_file():
        return {"pending": pending, "completed": completed}
    try:
        for line in plan_file.read_text(
            encoding="utf-8", errors="replace"
        ).splitlines():
            s = line.strip()
            if s.startswith("[ ]"):
                pending.append(s[3:].strip())
            elif s.startswith("[x]") or s.startswith("[X]"):
                completed.append(s[3:].strip())
    except Exception:
        pass
    return {"pending": pending, "completed": completed}


def save_snapshot(data: Dict[str, Any]) -> Path:
    out_dir = Path(".aiflow")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "checkpoint-latest.json"
    out_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return out_path


def main() -> int:
    s_id, title, turn_count = get_session_stats()
    branch, diff_stat = get_git_state()
    tasks = parse_plan_tasks()
    now_iso = datetime.now(timezone.utc).isoformat()
    snapshot = {
        "timestamp": now_iso,
        "session_id": s_id,
        "session_title": title,
        "turn_count": turn_count,
        "branch": branch,
        "tasks": tasks,
        "git_diff_summary": diff_stat,
    }
    out_file = save_snapshot(snapshot)
    print(f"\033[92m✓ Checkpoint gravado com sucesso em {out_file}\033[0m")
    print(f"  • Sessão: {s_id} ({title})")
    print(f"  • Turnos acumulados: {turn_count}")
    print(f"  • Branch: {branch}")
    print(
        f"  • Tarefas: {len(tasks['pending'])} pendentes, {len(tasks['completed'])} concluídas"
    )
    if turn_count >= 40:
        print(ALERT_MSG)
    return 0


if __name__ == "__main__":
    sys.exit(main())

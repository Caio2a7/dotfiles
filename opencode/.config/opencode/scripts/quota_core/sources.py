"""sources.py - Quota data sources: Claude plan (opencode-claude) and OpenRouter."""

from __future__ import annotations

import datetime
import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

CLAUDE_RATE_LIMIT_PATH = os.path.expanduser(
    "~/.local/share/opencode-claude/rate-limit.json"
)
OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key"


def _ms_to_iso(ms: Optional[float]) -> Optional[str]:
    if not isinstance(ms, (int, float)):
        return None
    return datetime.datetime.fromtimestamp(
        ms / 1000, tz=datetime.timezone.utc
    ).isoformat()


def fetch_claude_plan_status() -> Dict[str, Any]:
    """Reads the Claude plan limit state recorded by the opencode-claude plugin."""
    if not os.path.exists(CLAUDE_RATE_LIMIT_PATH):
        return {"status": "unavailable", "message": "nenhum turno Claude registrado ainda"}
    try:
        with open(CLAUDE_RATE_LIMIT_PATH, encoding="utf-8") as fh:
            raw = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        return {"status": "error", "message": f"falha ao ler {CLAUDE_RATE_LIMIT_PATH}: {exc}"}
    return {
        "status": "ok",
        "limited": bool(raw.get("limited")),
        "state": raw.get("status", "unknown"),
        "window": raw.get("rateLimitType"),
        "utilization": raw.get("utilization"),
        "resets_at": _ms_to_iso(raw.get("resetsAt")),
        "updated_at": _ms_to_iso(raw.get("updatedAt")),
    }


def fetch_openrouter_quota() -> Dict[str, Any]:
    """Queries the OpenRouter key endpoint for usage and limits."""
    key = os.environ.get("OPENROUTER_FREE_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
    if not key:
        return {"status": "not_configured"}
    req = urllib.request.Request(
        OPENROUTER_KEY_URL, headers={"Authorization": f"Bearer {key}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            payload = json.load(resp)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return {"status": "error", "message": str(exc)}
    return {"status": "ok", "data": payload.get("data", {})}

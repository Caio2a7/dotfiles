"""detector.py - Detection of active provider, model, and classification."""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Dict, Optional, Tuple

HOME = os.path.expanduser("~")
DB_PATH = os.path.join(HOME, ".local/share/opencode/opencode.db")
MODEL_STATE_PATH = os.path.join(HOME, ".local/state/opencode/model.json")
CONFIG_PATH = os.path.join(HOME, ".config/opencode/opencode.json")


def _detect_from_session_table(
    cur: sqlite3.Cursor, cwd: str
) -> Optional[Dict[str, Any]]:
    cur.execute(
        "SELECT model FROM session WHERE directory = ? AND model IS NOT NULL ORDER BY time_updated DESC LIMIT 1;",
        (cwd,),
    )
    row = cur.fetchone()
    if not row or not row[0]:
        cur.execute(
            "SELECT model FROM session WHERE model IS NOT NULL ORDER BY time_updated DESC LIMIT 1;"
        )
        row = cur.fetchone()

    if row and row[0]:
        data = json.loads(row[0])
        if isinstance(data, dict) and data.get("id"):
            return {
                "provider_id": data.get("providerID", "unknown"),
                "model_id": data.get("id"),
                "variant": data.get("variant"),
                "source": "session",
            }
    return None


def _detect_from_db() -> Optional[Dict[str, Any]]:
    if not os.path.exists(DB_PATH):
        return None
    try:
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=1.0)
        cur = con.cursor()
        res = _detect_from_session_table(cur, os.getcwd())
        if res:
            return res

        cur.execute(
            "SELECT data FROM message WHERE data IS NOT NULL ORDER BY time_created DESC LIMIT 1;"
        )
        row = cur.fetchone()
        if row and row[0]:
            msg_data = json.loads(row[0])
            if msg_data.get("modelID") and msg_data.get("providerID"):
                return {
                    "provider_id": msg_data.get("providerID"),
                    "model_id": msg_data.get("modelID"),
                    "variant": None,
                    "source": "message",
                }
    except Exception:
        pass
    return None


def _detect_from_model_json() -> Optional[Dict[str, Any]]:
    if not os.path.exists(MODEL_STATE_PATH):
        return None
    try:
        with open(MODEL_STATE_PATH, "r", encoding="utf-8") as f:
            state = json.load(f)
            recent = state.get("recent", [])
            if recent and isinstance(recent, list):
                item = recent[0]
                return {
                    "provider_id": item.get("providerID", "unknown"),
                    "model_id": item.get("modelID", "unknown"),
                    "variant": None,
                    "source": "recent_models",
                }
    except Exception:
        pass
    return None


def _detect_from_config() -> Optional[Dict[str, Any]]:
    if not os.path.exists(CONFIG_PATH):
        return None
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            def_model = cfg.get("model", "")
            if "/" in def_model:
                prov, mid = def_model.split("/", 1)
                return {
                    "provider_id": prov,
                    "model_id": mid,
                    "variant": None,
                    "source": "config",
                }
    except Exception:
        pass
    return None


def detect_active_model() -> Dict[str, Any]:
    """Detects active provider, model ID, and variant from OpenCode state."""
    db_res = _detect_from_db()
    if db_res:
        return db_res

    mj_res = _detect_from_model_json()
    if mj_res:
        return mj_res

    cfg_res = _detect_from_config()
    if cfg_res:
        return cfg_res

    return {
        "provider_id": "claude-code",
        "model_id": "claude-sonnet-5-5",
        "variant": None,
        "source": "default",
    }


def classify_model(provider_id: str, model_id: str) -> Tuple[str, str, str]:
    """Categorizes model into provider, group key, and friendly label."""
    mid = (model_id or "").lower()
    pid = (provider_id or "").lower()

    if pid == "claude-code":
        return "claude-code", "claude-plan", "Plano Claude (Pro/Max)"

    if "openrouter" in pid or any(
        k in mid for k in ["minimax", "qwen", "llama", "glm", "nousresearch"]
    ):
        return "openrouter", "openrouter", "OpenRouter"

    return pid, "default", provider_id

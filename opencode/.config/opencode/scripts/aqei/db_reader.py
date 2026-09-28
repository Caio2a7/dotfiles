#!/usr/bin/env python3
"""db_reader.py - Safe database reader and OpenCode session analyzer."""

from __future__ import annotations

import ast
import json
import os
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

from aqei.auditor import CodeStubAuditor
from aqei.calculator import AQEICalculator
from aqei.models import AQEIResult, SessionRawData


class OpenCodeDBReader:
    """Read-only safe connector to OpenCode SQLite storage."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.path.expanduser("~/.local/share/opencode/opencode.db")

    def is_available(self) -> bool:
        return os.path.exists(self.db_path)

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True, timeout=3.0)

    def resolve_session_id(self, identifier: str) -> Optional[str]:
        if identifier != "latest":
            return identifier
        if not self.is_available():
            return None
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM session ORDER BY time_updated DESC LIMIT 1;")
            row = cur.fetchone()
            return row[0] if row else None

    @staticmethod
    def _fetch_parts(conn: sqlite3.Connection, session_id: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        cur = conn.cursor()
        cur.execute("SELECT id, data FROM part WHERE session_id = ? ORDER BY time_created ASC;", (session_id,))
        tools, reasoning = [], []
        for row in cur.fetchall():
            if not row[1]:
                continue
            try:
                data = json.loads(row[1])
                p_type = data.get("type")
                if p_type == "tool":
                    tools.append(data)
                elif p_type == "reasoning" and data.get("text"):
                    reasoning.append(data["text"])
            except Exception:
                continue
        return tools, reasoning

    def fetch_session_data(self, session_id: str) -> Optional[SessionRawData]:
        if not self.is_available():
            return None
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, title, tokens_input, tokens_output, tokens_reasoning,
                       tokens_cache_read, tokens_cache_write
                FROM session WHERE id = ?;
            """, (session_id,))
            s_row = cur.fetchone()
            if not s_row:
                return None
            s_id, title, t_in, t_out, t_reason, t_cread, t_cwrite = s_row

            cur.execute("SELECT id, data FROM message WHERE session_id = ? ORDER BY time_created ASC;", (session_id,))
            messages = []
            for row in cur.fetchall():
                try:
                    messages.append(json.loads(row[1]) if row[1] else {})
                except Exception:
                    continue

            tools, reasoning = self._fetch_parts(conn, session_id)
            return SessionRawData(
                session_id=s_id, title=title or "Sem título", tokens_input=t_in or 0,
                tokens_output=t_out or 0, tokens_reasoning=t_reason or 0,
                tokens_cache_read=t_cread or 0, tokens_cache_write=t_cwrite or 0,
                tool_calls=tools, messages=messages, reasoning_blocks=reasoning,
            )


class SessionAnalyzer:
    """Evaluates an OpenCode session to produce an AQEI score."""

    @staticmethod
    def _audit_tool_mutations(tool_calls: List[Dict[str, Any]]) -> Tuple[int, int, int]:
        stubs_found, mutations_count, syntax_errors = 0, 0, 0
        for tc in tool_calls:
            if tc.get("tool") in ("write", "edit"):
                mutations_count += 1
                state = tc.get("state") if isinstance(tc.get("state"), dict) else {}
                inp = state.get("input") if isinstance(state.get("input"), dict) else {}
                content = str(inp.get("content") or inp.get("newString") or "")
                path = inp.get("filePath") or ""
                stubs = CodeStubAuditor.audit_content(content, path)
                stubs_found += len(stubs)
                if path.endswith(".py") and content:
                    try:
                        ast.parse(content)
                    except SyntaxError:
                        syntax_errors += 1
        return stubs_found, mutations_count, syntax_errors

    @classmethod
    def analyze(cls, raw: SessionRawData) -> AQEIResult:
        d1 = AQEICalculator.calculate_csi(raw.tool_calls)
        total_steps = len(raw.tool_calls) + len(raw.reasoning_blocks)
        d2 = AQEICalculator.calculate_tber(raw.tokens_input, raw.tokens_output, raw.tokens_cache_read, total_steps)
        stubs_found, mutations_count, syntax_errors = cls._audit_tool_mutations(raw.tool_calls)
        d3 = AQEICalculator.calculate_rcp(stubs_found, mutations_count)
        tokens_total = raw.tokens_input + raw.tokens_output + raw.tokens_reasoning + raw.tokens_cache_read + raw.tokens_cache_write
        chars = sum(len(b) for b in raw.reasoning_blocks)
        d4 = AQEICalculator.calculate_cpi(len(raw.reasoning_blocks), len(raw.tool_calls), chars, tokens_total)
        d5 = AQEICalculator.calculate_dsir(0, 0, syntax_errors, max(1, mutations_count))
        return AQEICalculator.synthesize_result([d1, d2, d3, d4, d5], session_id=raw.session_id)

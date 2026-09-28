#!/usr/bin/env python3
"""penalties.py - Penalty calculation heuristics and inspection for AQEI dimensions."""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Sequence, Tuple


def extract_csi_signature(tool: str, inp: Dict[str, Any]) -> str:
    """Extract idempotent comparison signature for tool invocation."""
    if tool == "bash":
        return f"bash:{str(inp.get('command', '')).strip()}"
    if tool in ("read", "grep", "glob"):
        return f"{tool}:{inp.get('filePath') or inp.get('pattern')}"
    if tool in ("write", "edit"):
        return f"{tool}:{inp.get('filePath')}"
    return ""


def is_repeated_idempotent_cmd(
    tool: str, inp: Dict[str, Any], sig: str, last_sig: Optional[str]
) -> bool:
    """Check if tool call is an idempotent command repeated in a loop."""
    if tool == "bash":
        cmd = str(inp.get("command", "")).strip()
        cmd_root = cmd.split()[0] if cmd.split() else ""
        if cmd_root in ("date", "pwd"):
            return False
        idem = {"ls", "git status", "git diff", "whoami"}
        return (
            cmd_root in idem or cmd in ("git status", "ls -la", "ls")
        ) and last_sig == sig
    return (tool in ("read", "grep", "glob")) and last_sig == sig


def is_permission_denial(call: Dict[str, Any], state: Dict[str, Any]) -> bool:
    """Determine whether tool failure was caused by permission denial or policy gating."""
    raw = str(
        state.get("error") or state.get("output") or call.get("error") or ""
    ).lower()
    return (
        "rule which prevents you from using this specific tool call" in raw
        or "permission denied" in raw
    )


def inspect_tool_calls(tool_calls: Sequence[Dict[str, Any]]) -> Tuple[int, int, int]:
    """Inspect tool execution sequence returning repetitions, errors and permission denials."""
    repetitions, error_count, perm_denials = 0, 0, 0
    last_sig: Optional[str] = None
    for call in tool_calls:
        tool = call.get("tool", "")
        state = call.get("state") if isinstance(call.get("state"), dict) else {}
        status = state.get("status", "completed")
        inp = state.get("input") if isinstance(state.get("input"), dict) else {}
        if status not in ("completed", "success"):
            if is_permission_denial(call, state):
                perm_denials += 1
            else:
                error_count += 1
        sig = extract_csi_signature(tool, inp)
        if is_repeated_idempotent_cmd(tool, inp, sig, last_sig):
            repetitions += 1
        last_sig = sig
    return repetitions, error_count, perm_denials


def compute_csi_penalties(
    repetitions: int, error_count: int, perm_denials: int, total_tools: int
) -> Tuple[float, List[str]]:
    """Compute deductions and score for CSI (Circuit Breaker & Tool Stability)."""
    score, deductions = 100.0, []
    if repetitions > 0:
        penalty = min(40.0, repetitions * 15.0)
        score -= penalty
        deductions.append(
            f"Detectadas {repetitions} chamadas de ferramentas repetitivas em loop (-{penalty:.1f} pts)"
        )
    if error_count > 0:
        rate = error_count / total_tools
        penalty = min(35.0, rate * 50.0 + error_count * 5.0)
        score -= penalty
        deductions.append(
            f"{error_count} erros de execução em ferramentas ({rate:.1%}) (-{penalty:.1f} pts)"
        )
    if perm_denials > 0:
        perm_penalty = perm_denials * 1.0
        score -= perm_penalty
        deductions.append(
            f"{perm_denials} bloqueio(s) preventivo(s) de permissão / gating mecânico (-{perm_penalty:.1f} pts)"
        )
    return max(0.0, min(100.0, score)), deductions


def compute_tber_penalties(
    ratio: float, avg_in: float, steps: int
) -> Tuple[float, List[str]]:
    """Compute deductions and score for TBER (Token Bloat & Cache Economy)."""
    score, deductions = 100.0, []
    if steps > 3:
        if ratio < 0.30:
            penalty = 25.0 * (1.0 - (ratio / 0.30))
            score -= penalty
            deductions.append(
                f"Taxa de cache read sub-ótima ({ratio:.1%}, alvo >= 50%) (-{penalty:.1f} pts)"
            )
        elif ratio >= 0.70:
            score = min(100.0, score + 2.0)
    if steps > 0 and avg_in > 60000:
        penalty = min(30.0, (avg_in - 60000) / 10000.0 * 5.0)
        score -= penalty
        deductions.append(
            f"Volume elevado de tokens de entrada sem cache ({avg_in:.0f} t/step) (-{penalty:.1f} pts)"
        )
    return max(0.0, min(100.0, score)), deductions


def compute_cpi_penalties(
    reasons: int, tools: int, chars: int, tokens: int
) -> Tuple[float, List[str]]:
    """Compute deductions and score for CPI (Cognitive Density & Reasoning)."""
    score, deductions = 100.0, []
    if tools > 0:
        ratio = reasons / tools
        if reasons == 0:
            score -= 35.0
            deductions.append(
                "Ausência de raciocínio prévio para as ferramentas chamadas (-35.0 pts)"
            )
        elif ratio < 0.30:
            score -= 15.0
            deductions.append(
                f"Baixa densidade cognitiva ({ratio:.1%} reasoning/tool ratio) (-15.0 pts)"
            )
    if reasons == 0 and tokens > 10000:
        penalty = min(35.0, ((tokens - 10000) / 10000.0) * 5.0)
        score -= penalty
        deductions.append(
            f"Ausência de raciocínio com alto consumo de tokens ({tokens} tokens) (-{penalty:.1f} pts)"
        )
    if reasons > 0 and chars < 50:
        score -= 10.0
        deductions.append("Raciocínio excessivamente superficial (-10.0 pts)")
    return max(0.0, min(100.0, score)), deductions

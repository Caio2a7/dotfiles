#!/usr/bin/env python3
"""calculator.py - Mathematical index scorer for the 5-dimension AQEI model."""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Sequence
from aqei.models import (
    AQEIResult,
    DimensionScore,
    WEIGHT_CPI,
    WEIGHT_CSI,
    WEIGHT_DSIR,
    WEIGHT_RCP,
    WEIGHT_TBER,
)
from aqei.penalties import (
    compute_cpi_penalties,
    compute_csi_penalties,
    compute_tber_penalties,
    extract_csi_signature,
    inspect_tool_calls,
    is_permission_denial,
    is_repeated_idempotent_cmd,
)


class AQEICalculator:
    """Mathematical index scorer applying the 5-dimension weighted model."""

    _extract_csi_signature = staticmethod(extract_csi_signature)
    _is_repeated_idempotent_cmd = staticmethod(is_repeated_idempotent_cmd)
    _is_permission_denial = staticmethod(is_permission_denial)
    _inspect_tool_calls = staticmethod(inspect_tool_calls)
    _compute_csi_penalties = staticmethod(compute_csi_penalties)
    _compute_tber_penalties = staticmethod(compute_tber_penalties)
    _compute_cpi_penalties = staticmethod(compute_cpi_penalties)

    @classmethod
    def calculate_csi(cls, tool_calls: Sequence[Dict[str, Any]]) -> DimensionScore:
        """D1: Circuit Breaker & Tool Stability (Weight 0.20)."""
        if not tool_calls:
            return DimensionScore(
                "CSI", "Tool Discipline & Loop Prevention", WEIGHT_CSI, 100.0,
                {"total_tools": 0, "repetitions": 0, "errors": 0}, [],
            )
        reps, errs, perms = inspect_tool_calls(tool_calls)
        n = len(tool_calls)
        score, deductions = compute_csi_penalties(reps, errs, perms, n)
        return DimensionScore(
            "CSI", "Tool Discipline & Loop Prevention", WEIGHT_CSI, score,
            {"total_tools": n, "repetitions": reps, "errors": errs, "perm_denials": perms},
            deductions,
        )

    @classmethod
    def calculate_tber(
        cls, tokens_in: int, tokens_out: int, tokens_read: int, steps: int
    ) -> DimensionScore:
        """D2: Token Bloat & Cache Economy (Weight 0.15)."""
        flow = tokens_in + tokens_read
        ratio = (tokens_read / flow) if flow > 0 else 0.0
        avg_in = tokens_in / steps if steps > 0 else 0.0
        score, deductions = compute_tber_penalties(ratio, avg_in, steps)
        metrics = {
            "tokens_input": tokens_in, "tokens_output": tokens_out,
            "tokens_cache_read": tokens_read, "cache_ratio": ratio,
        }
        return DimensionScore(
            "TBER", "Token Bloat & Cache Economy", WEIGHT_TBER, score, metrics, deductions
        )

    @staticmethod
    def calculate_rcp(stubs_found: int, mutations: int) -> DimensionScore:
        """D3: Rigor & Code Cleanliness / Anti-Stub (Weight 0.35)."""
        deductions: List[str] = []
        score = 100.0
        if stubs_found > 0:
            penalty = min(100.0, 25.0 + (stubs_found - 1) * 15.0)
            score -= penalty
            deductions.append(
                f"Detectados {stubs_found} stubs de código (TODO/FIXME/pass/placeholder) (-{penalty:.1f} pts)"
            )
        return DimensionScore(
            "RCP", "Rigor & Anti-Stub Rigidity", WEIGHT_RCP,
            max(0.0, min(100.0, score)),
            {"stubs_found": stubs_found, "mutations": mutations}, deductions,
        )

    @classmethod
    def calculate_cpi(
        cls, reasons: int, tools: int, chars: int, tokens_total: int = 0
    ) -> DimensionScore:
        """D4: Cognitive Flow & Reasoning Depth (Weight 0.15)."""
        score, deductions = compute_cpi_penalties(reasons, tools, chars, tokens_total)
        metrics = {
            "reasoning_blocks": reasons, "tool_calls": tools,
            "reasoning_chars": chars, "tokens_total": tokens_total,
        }
        return DimensionScore(
            "CPI", "Cognitive Density & Reasoning", WEIGHT_CPI, score, metrics, deductions
        )

    @staticmethod
    def calculate_dsir(
        files_over: int, fns_over: int, syntax_errs: int, total_files: int
    ) -> DimensionScore:
        """D5: Density & Structural Integrity / Modularity (Weight 0.15)."""
        deductions: List[str] = []
        score = 100.0
        if syntax_errs > 0:
            penalty = min(50.0, syntax_errs * 25.0)
            score -= penalty
            deductions.append(f"{syntax_errs} erro(s) de sintaxe AST detectados (-{penalty:.1f} pts)")
        if files_over > 0:
            penalty = min(30.0, files_over * 10.0)
            score -= penalty
            deductions.append(f"{files_over} arquivo(s) excedem limite de 300 linhas (-{penalty:.1f} pts)")
        if fns_over > 0:
            penalty = min(25.0, fns_over * 5.0)
            score -= penalty
            deductions.append(f"{fns_over} função(ões) excedem limite de 40 linhas (-{penalty:.1f} pts)")
        metrics = {
            "files_over_300": files_over, "functions_over_40": fns_over,
            "syntax_errors": syntax_errs, "total_files": total_files,
        }
        return DimensionScore(
            "DSIR", "Modularity & Architectural Limits", WEIGHT_DSIR,
            max(0.0, min(100.0, score)), metrics, deductions,
        )

    @staticmethod
    def _determine_status(global_score: float) -> str:
        if global_score >= 99.0:
            return "PADRÃO OURO SOTA >= 99%"
        if global_score >= 90.0:
            return "PRODUÇÃO EXCELENTE"
        if global_score >= 75.0:
            return "ACEITÁVEL / SUB-ÓTIMO"
        return "CRÍTICO"

    @staticmethod
    def _map_deduction_to_rec(code: str, deduction: str) -> str:
        low = deduction.lower()
        rules = (
            ("stubs", "Eliminar todos os stubs (TODO, pass, placeholders): implemente lógica concreta e completa (Ponytail/YAGNI)."),
            ("repetitivas", "Ativar Circuit Breaker: eliminar repetições de comandos de leitura (ls, git status) sem mutação."),
            ("cache read", "Otimizar Context Caching: reutilizar prefixos estáveis de prompt e evitar invalidações prematuras."),
            ("300 linhas", "Decompor arquivos > 300 linhas em módulos com responsabilidade única."),
            ("40 linhas", "Refatorar funções > 40 linhas extraindo sub-rotinas e aplicando guard clauses."),
            ("sintaxe", "Corrigir imediatamente erros de sintaxe e garantir integridade da árvore AST."),
            ("raciocínio", "Adicionar raciocínio estruturado prévio antes de invocar comandos executivos."),
        )
        for key, text in rules:
            if key in low:
                return f"[{code}] {text}"
        return f"[{code}] {deduction}"

    @classmethod
    def _build_recommendations(cls, dimensions: List[DimensionScore]) -> List[str]:
        recommendations: List[str] = []
        for d in dimensions:
            if d.score < 99.0:
                for deduction in d.deductions:
                    recommendations.append(cls._map_deduction_to_rec(d.code, deduction))
        if not recommendations:
            recommendations.append(
                "Nenhuma deficiência encontrada. Excelência técnica e conformidade total com SOTA."
            )
        return list(dict.fromkeys(recommendations))

    @classmethod
    def synthesize_result(
        cls,
        dimensions: List[DimensionScore],
        session_id: Optional[str] = None,
        target_path: Optional[str] = None,
    ) -> AQEIResult:
        """Synthesize dimension scores into an AQEIResult."""
        raw_sum = sum(d.weighted_contribution for d in dimensions)
        global_score = round(max(0.0, min(100.0, raw_sum)), 2)
        status = cls._determine_status(global_score)
        recs = cls._build_recommendations(dimensions)
        return AQEIResult(
            global_score=global_score,
            status=status,
            dimensions=dimensions,
            recommendations=recs,
            session_id=session_id,
            target_path=target_path,
        )

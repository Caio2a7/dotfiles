#!/usr/bin/env python3
"""reporter.py - ANSI formatter and terminal reporter for AQEI results."""

from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

from aqei.models import (
    AQEIResult,
    AuditViolation,
    CLR_BLUE,
    CLR_BOLD,
    CLR_CYAN,
    CLR_DIM,
    CLR_GOLD,
    CLR_GREEN,
    CLR_MAGENTA,
    CLR_RED,
    CLR_RESET,
    CLR_WHITE,
    CLR_YELLOW,
    DimensionScore,
    DirectoryAuditReport,
)


class AnsiReporter:
    """Generates clean, professional ANSI terminal reports and scorecards."""

    @staticmethod
    def _score_color(score: float) -> Tuple[str, str]:
        if score >= 99.0:
            return CLR_GOLD + CLR_BOLD, CLR_GOLD + CLR_BOLD
        if score >= 90.0:
            return CLR_GREEN + CLR_BOLD, CLR_GREEN + CLR_BOLD
        if score >= 75.0:
            return CLR_YELLOW + CLR_BOLD, CLR_YELLOW
        return CLR_RED + CLR_BOLD, CLR_RED

    @classmethod
    def _render_dimension_rows(cls, dimensions: List[DimensionScore]) -> List[str]:
        rows: List[str] = []
        for d in dimensions:
            d_clr = CLR_GREEN if d.score >= 95.0 else (CLR_YELLOW if d.score >= 80.0 else CLR_RED)
            rows.append(
                f"  {d.code:<5} | {d.name:<34} | {d.weight:>4.0%}   | "
                f"{d_clr}{d.score:>5.1f}%{CLR_RESET}  | {d.weighted_contribution:>6.2f} pts"
            )
        return rows

    @classmethod
    def render_aqei_result(cls, result: AQEIResult, title: str = "AGENTIC QUALITY & EFFICIENCY INDEX") -> str:
        width = 84
        border, thin = "=" * width, "-" * width
        status_clr, score_clr = cls._score_color(result.global_score)
        out = [
            f"\n{CLR_BOLD}{CLR_CYAN}{border}{CLR_RESET}",
            f"{CLR_BOLD}{CLR_WHITE}  {title.center(width - 4)}{CLR_RESET}",
        ]
        if result.session_id:
            out.append(f"{CLR_DIM}  Session ID: {result.session_id:<70}{CLR_RESET}")
        if result.target_path:
            out.append(f"{CLR_DIM}  Target:     {result.target_path:<70}{CLR_RESET}")
        out.extend([
            f"{CLR_BOLD}{CLR_CYAN}{thin}{CLR_RESET}",
            f"{CLR_BOLD}  {'DIM':<5} | {'DIMENSÃO':<34} | {'PESO':<6} | {'SCORE':<7} | {'CONTRIB':<8}{CLR_RESET}",
            f"  {'-' * 5}-+-{'-' * 34}-+-{'-' * 6}-+-{'-' * 7}-+-{'-' * 8}",
        ])
        out.extend(cls._render_dimension_rows(result.dimensions))
        out.extend([
            f"{CLR_BOLD}{CLR_CYAN}{thin}{CLR_RESET}",
            f"  {CLR_BOLD}AQEI GLOBAL COMPOSITE:{CLR_RESET} {score_clr}{result.global_score:>6.2f} / 100.0{CLR_RESET}  [{status_clr}{result.status}{CLR_RESET}]",
            f"{CLR_BOLD}{CLR_CYAN}{border}{CLR_RESET}",
            f"\n{CLR_BOLD}{CLR_WHITE}📌 PLANO DE AÇÃO & RECOMENDAÇÕES PARA 99% SOTA:{CLR_RESET}",
        ])
        for rec in result.recommendations:
            bullet = f"{CLR_GREEN}✓{CLR_RESET}" if "Nenhuma" in rec else f"{CLR_YELLOW}▶{CLR_RESET}"
            out.append(f"  {bullet} {rec}")
        out.append("")
        return "\n".join(out)

    @staticmethod
    def _render_violations(violations: List[AuditViolation]) -> List[str]:
        out = [f"\n{CLR_BOLD}{CLR_WHITE}⚠️  DETALHAMENTO DAS VIOLAÇÕES ENCONTRADAS:{CLR_RESET}"]
        for v in violations[:15]:
            out.append(f"  {CLR_RED}✖{CLR_RESET} [{v.violation_type}] {Path(v.file_path).name}:{v.line_number} -> {v.description}")
        if len(violations) > 15:
            out.append(f"  {CLR_DIM}... e mais {len(violations) - 15} violações omitidas.{CLR_RESET}")
        return out

    @classmethod
    def render_directory_report(cls, report: DirectoryAuditReport, target_path: str) -> str:
        width = 84
        border, thin = "=" * width, "-" * width
        stubs_clr = CLR_GREEN if report.stubs_count == 0 else CLR_RED
        files_clr = CLR_GREEN if len(report.files_over_limit) == 0 else CLR_YELLOW
        fns_clr = CLR_GREEN if len(report.functions_over_limit) == 0 else CLR_YELLOW
        syn_clr = CLR_GREEN if len(report.syntax_errors) == 0 else CLR_RED

        out = [
            f"\n{CLR_BOLD}{CLR_BLUE}{border}{CLR_RESET}",
            f"{CLR_BOLD}{CLR_WHITE}  AUDITORIA DE CÓDIGO FONTE (SOTA ANTI-SLOP & LIMITES ARQUITETURAIS){CLR_RESET}",
            f"{CLR_DIM}  Target: {target_path}{CLR_RESET}",
            f"{CLR_BOLD}{CLR_BLUE}{thin}{CLR_RESET}",
            f"  • Total de Arquivos Analisados:   {report.total_files:>6}",
            f"  • Total de Linhas de Código:      {report.total_lines:>6}",
            f"  • Stubs Detectados (TODO/pass):   {stubs_clr}{report.stubs_count:>6}{CLR_RESET}",
            f"  • Arquivos > 300 Linhas:          {files_clr}{len(report.files_over_limit):>6}{CLR_RESET}",
            f"  • Funções > 40 Linhas:            {fns_clr}{len(report.functions_over_limit):>6}{CLR_RESET}",
            f"  • Erros de Sintaxe AST:           {syn_clr}{len(report.syntax_errors):>6}{CLR_RESET}",
        ]
        if report.violations:
            out.extend(cls._render_violations(report.violations))
        out.append(f"{CLR_BOLD}{CLR_BLUE}{border}{CLR_RESET}\n")
        return "\n".join(out)

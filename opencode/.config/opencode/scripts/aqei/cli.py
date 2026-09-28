#!/usr/bin/env python3
"""cli.py - Argument parsing and CLI controller routines for AQEI Scorer."""

from __future__ import annotations

import argparse
from contextlib import redirect_stdout
import io
import json
import sqlite3
import sys
from typing import Any, Dict

from aqei.auditor import DirectoryAuditor
from aqei.calculator import AQEICalculator
from aqei.db_reader import OpenCodeDBReader, SessionAnalyzer
from aqei.harness import SyntheticBenchmarkHarness
from aqei.models import (
    AQEIResult,
    CLR_RED,
    CLR_RESET,
    DimensionScore,
    WEIGHT_CPI,
    WEIGHT_CSI,
    WEIGHT_TBER,
)
from aqei.reporter import AnsiReporter


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="AQEI Scorer - Agentic Quality & Efficiency Index Auditor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--session", type=str, help="Analisa sessão real no banco OpenCode SQLite ('<session_id>' ou 'latest')")
    group.add_argument("--test", "--benchmark", action="store_true", dest="benchmark", help="Executa o harness de testes unitários e o ciclo de refinamento 99%%")
    group.add_argument("--audit-dir", type=str, help="Audita árvore de arquivos de código (stubs, arquivos > 300 linhas, funções > 40 linhas, AST)")
    parser.add_argument("--json", action="store_true", help="Exibe resultado estruturado em JSON para integração programática")
    return parser.parse_args()


def _serialize_result(res: AQEIResult) -> Dict[str, Any]:
    return {
        "session_id": res.session_id,
        "global_score": res.global_score,
        "status": res.status,
        "dimensions": [
            {
                "code": d.code, "name": d.name, "weight": d.weight,
                "score": d.score, "contribution": d.weighted_contribution,
                "deductions": d.deductions, "raw_metrics": d.raw_metrics,
            }
            for d in res.dimensions
        ],
        "recommendations": res.recommendations,
    }


def run_session_mode(session_arg: str, json_output: bool) -> int:
    """Execute session analysis from database."""
    try:
        reader = OpenCodeDBReader()
        if not reader.is_available():
            print(f"{CLR_RED}Erro: Banco OpenCode não encontrado em {reader.db_path}{CLR_RESET}", file=sys.stderr)
            return 1
        session_id = reader.resolve_session_id(session_arg)
        if not session_id:
            print(f"{CLR_RED}Erro: Não foi possível resolver a sessão '{session_arg}'.{CLR_RESET}", file=sys.stderr)
            return 1
        raw_data = reader.fetch_session_data(session_id)
        if not raw_data:
            print(f"{CLR_RED}Erro: Sessão '{session_id}' não encontrada no banco de dados.{CLR_RESET}", file=sys.stderr)
            return 1

        result = SessionAnalyzer.analyze(raw_data)
        if json_output:
            print(json.dumps(_serialize_result(result), indent=2, ensure_ascii=False))
        else:
            print(AnsiReporter.render_aqei_result(result, f"SESSÃO OPENCODE: {raw_data.title}"))
        return 0
    except sqlite3.Error as err:
        print(f"{CLR_RED}Erro SQLite ao acessar banco OpenCode: {err}{CLR_RESET}", file=sys.stderr)
        return 1


def run_audit_dir_mode(target_path: str, json_output: bool) -> int:
    """Execute static codebase audit on a directory."""
    try:
        report = DirectoryAuditor.audit(target_path)
    except Exception as e:
        print(f"{CLR_RED}Erro durante auditoria: {e}{CLR_RESET}", file=sys.stderr)
        return 1

    d3 = AQEICalculator.calculate_rcp(report.stubs_count, report.total_files)
    d5 = AQEICalculator.calculate_dsir(len(report.files_over_limit), len(report.functions_over_limit), len(report.syntax_errors), report.total_files)
    d1 = DimensionScore("CSI", "Tool Discipline (Estático)", WEIGHT_CSI, 100.0, {}, [])
    d2 = DimensionScore("TBER", "Token Economy (Estático)", WEIGHT_TBER, 100.0, {}, [])
    d4 = DimensionScore("CPI", "Cognitive Density (Estático)", WEIGHT_CPI, 100.0, {}, [])
    result = AQEICalculator.synthesize_result([d1, d2, d3, d4, d5], target_path=target_path)

    if json_output:
        dump = {
            "target_path": target_path, "global_score": result.global_score, "status": result.status,
            "total_files": report.total_files, "total_lines": report.total_lines, "stubs_count": report.stubs_count,
            "files_over_300": report.files_over_limit, "functions_over_40": report.functions_over_limit,
            "syntax_errors": report.syntax_errors, "recommendations": result.recommendations,
        }
        print(json.dumps(dump, indent=2, ensure_ascii=False))
    else:
        print(AnsiReporter.render_directory_report(report, target_path))
        print(AnsiReporter.render_aqei_result(result, f"AUDITORIA AQEI DE CÓDIGO FONTE: {target_path}"))
    return 0


def _run_benchmark_json() -> int:
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        s1 = SyntheticBenchmarkHarness._scenario_perfect_session()
        s2 = SyntheticBenchmarkHarness._scenario_stubbed_session()
        s3 = SyntheticBenchmarkHarness._scenario_looping_session()
        s4 = SyntheticBenchmarkHarness._scenario_token_bloat_session()
        ast_ok = SyntheticBenchmarkHarness._test_ast_and_lexical_stub_detector()

    p1 = s1.global_score >= 99.0
    p2 = s2.global_score < 90.0 and s2.dimensions[2].score <= 60.0
    p3 = s3.dimensions[0].score < 80.0
    p4 = s4.dimensions[1].score < 85.0
    all_passed = p1 and p2 and p3 and p4 and ast_ok

    dump = {
        "all_passed": all_passed,
        "scenarios": [
            {"name": "perfect_session", "passed": p1, "result": _serialize_result(s1)},
            {"name": "stubbed_session", "passed": p2, "result": _serialize_result(s2)},
            {"name": "looping_session", "passed": p3, "result": _serialize_result(s3)},
            {"name": "token_bloat_session", "passed": p4, "result": _serialize_result(s4)},
            {"name": "ast_and_lexical_detector", "passed": ast_ok},
        ],
    }
    print(json.dumps(dump, indent=2, ensure_ascii=False))
    return 0 if all_passed else 1


def main() -> int:
    """Main CLI entrypoint."""
    args = parse_arguments()
    if args.benchmark:
        if args.json:
            return _run_benchmark_json()
        return 0 if SyntheticBenchmarkHarness.run_all() else 1
    if args.session:
        return run_session_mode(args.session, args.json)
    if args.audit_dir:
        return run_audit_dir_mode(args.audit_dir, args.json)
    return 0

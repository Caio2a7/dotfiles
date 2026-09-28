#!/usr/bin/env python3
"""harness.py - Synthetic benchmark scenarios, refinement cycle, and test suite."""

from __future__ import annotations

from typing import Callable, List, Tuple

from aqei.auditor import CodeStubAuditor
from aqei.calculator import AQEICalculator
from aqei.models import (
    AQEIResult,
    CLR_BLUE,
    CLR_BOLD,
    CLR_CYAN,
    CLR_GOLD,
    CLR_GREEN,
    CLR_MAGENTA,
    CLR_RED,
    CLR_RESET,
    CLR_WHITE,
    CLR_YELLOW,
    DimensionScore,
    WEIGHT_CPI,
    WEIGHT_CSI,
    WEIGHT_DSIR,
    WEIGHT_RCP,
    WEIGHT_TBER,
)
from aqei.reporter import AnsiReporter


class SyntheticBenchmarkHarness:
    """Embedded benchmark & test suite demonstrating synthetic agentic scenarios."""

    @classmethod
    def _scenario_perfect_session(cls) -> AQEIResult:
        tools = [
            {"tool": "bash", "state": {"status": "completed", "input": {"command": "ls"}}},
            {"tool": "read", "state": {"status": "completed", "input": {"filePath": "/src/main.py"}}},
            {"tool": "write", "state": {"status": "completed", "input": {"filePath": "/src/main.py"}}},
            {"tool": "bash", "state": {"status": "completed", "input": {"command": "python3 -m py_compile /src/main.py"}}},
        ]
        d1 = AQEICalculator.calculate_csi(tools)
        d2 = AQEICalculator.calculate_tber(tokens_in=25000, tokens_out=800, tokens_read=80000, steps=8)
        d3 = AQEICalculator.calculate_rcp(stubs_found=0, mutations=2)
        d4 = AQEICalculator.calculate_cpi(reasons=4, tools=4, chars=1200)
        d5 = AQEICalculator.calculate_dsir(files_over=0, fns_over=0, syntax_errs=0, total_files=5)
        return AQEICalculator.synthesize_result([d1, d2, d3, d4, d5], session_id="synthetic-perfect-sota")

    @classmethod
    def _scenario_stubbed_session(cls) -> AQEIResult:
        tools = [{"tool": "write", "state": {"status": "completed", "input": {"filePath": "/src/stub.py"}}}]
        d1 = AQEICalculator.calculate_csi(tools)
        d2 = AQEICalculator.calculate_tber(tokens_in=10000, tokens_out=300, tokens_read=40000, steps=4)
        d3 = AQEICalculator.calculate_rcp(stubs_found=3, mutations=1)
        d4 = AQEICalculator.calculate_cpi(reasons=2, tools=1, chars=500)
        d5 = AQEICalculator.calculate_dsir(files_over=0, fns_over=0, syntax_errs=0, total_files=1)
        return AQEICalculator.synthesize_result([d1, d2, d3, d4, d5], session_id="synthetic-stubbed")

    @classmethod
    def _scenario_looping_session(cls) -> AQEIResult:
        tools = [
            {"tool": "bash", "state": {"status": "completed", "input": {"command": "ls"}}},
            {"tool": "bash", "state": {"status": "completed", "input": {"command": "ls"}}},
            {"tool": "bash", "state": {"status": "completed", "input": {"command": "git status"}}},
            {"tool": "bash", "state": {"status": "completed", "input": {"command": "git status"}}},
            {"tool": "bash", "state": {"status": "error", "input": {"command": "invalid_cmd"}}},
        ]
        d1 = AQEICalculator.calculate_csi(tools)
        d2 = AQEICalculator.calculate_tber(tokens_in=15000, tokens_out=400, tokens_read=30000, steps=6)
        d3 = AQEICalculator.calculate_rcp(stubs_found=0, mutations=0)
        d4 = AQEICalculator.calculate_cpi(reasons=1, tools=5, chars=120)
        d5 = AQEICalculator.calculate_dsir(files_over=0, fns_over=0, syntax_errs=0, total_files=2)
        return AQEICalculator.synthesize_result([d1, d2, d3, d4, d5], session_id="synthetic-looping")

    @classmethod
    def _scenario_token_bloat_session(cls) -> AQEIResult:
        tools = [{"tool": "bash", "state": {"status": "completed", "input": {"command": "pwd"}}}]
        d1 = AQEICalculator.calculate_csi(tools)
        d2 = AQEICalculator.calculate_tber(tokens_in=280000, tokens_out=150, tokens_read=0, steps=4)
        d3 = AQEICalculator.calculate_rcp(stubs_found=0, mutations=0)
        d4 = AQEICalculator.calculate_cpi(reasons=2, tools=1, chars=400)
        d5 = AQEICalculator.calculate_dsir(files_over=0, fns_over=0, syntax_errs=0, total_files=1)
        return AQEICalculator.synthesize_result([d1, d2, d3, d4, d5], session_id="synthetic-bloated")

    @classmethod
    def _demonstrate_refinement_cycle(cls) -> None:
        print(f"\n{CLR_BOLD}{CLR_CYAN}{'=' * 84}{CLR_RESET}")
        print(f"{CLR_BOLD}{CLR_WHITE}  CICLO DE REFINAMENTO ITERATIVO: CONVERGÊNCIA ATÉ 99.7% SOTA{CLR_RESET}")
        print(f"{CLR_BOLD}{CLR_CYAN}{'=' * 84}{CLR_RESET}\n")

        steps = [
            ("Passo 0 (Baseline Cru com Stubs e Repetição)", [65.0, 75.0, 45.0, 80.0, 70.0], [["Loop de comandos"], ["Baixo cache"], ["3 Stubs encontrados"], ["Reasoning curto"], ["1 arquivo > 300 linhas"]]),
            ("Passo 1 (Remoção Total de Stubs - Ponytail/YAGNI)", [65.0, 75.0, 100.0, 80.0, 70.0], [[], [], [], [], []]),
            ("Passo 2 (Eliminação de Gagueira & Circuit Breaker)", [100.0, 75.0, 100.0, 85.0, 70.0], [[], [], [], [], []]),
            ("Passo 3 (Decomposição Modular: Arquivos <= 300 & Funções <= 40)", [100.0, 85.0, 100.0, 95.0, 100.0], [[], [], [], [], []]),
            ("Passo 4 (Otimização de Prompt Caching & Densidade Cognitiva -> 99.7% SOTA)", [100.0, 98.0, 100.0, 100.0, 100.0], [[], [], [], [], []]),
        ]
        meta = [("CSI", "Tool Discipline", WEIGHT_CSI), ("TBER", "Token Bloat", WEIGHT_TBER), ("RCP", "Rigor & Anti-Stub", WEIGHT_RCP), ("CPI", "Cognitive Flow", WEIGHT_CPI), ("DSIR", "Modularity Limits", WEIGHT_DSIR)]

        for label, scores, decs in steps:
            dims = [DimensionScore(m[0], m[1], m[2], s, {}, d) for m, s, d in zip(meta, scores, decs)]
            res = AQEICalculator.synthesize_result(dims)
            badge = f"{CLR_GOLD}{CLR_BOLD}★ SOTA ATINGIDO{CLR_RESET}" if res.global_score >= 99.0 else f"{CLR_YELLOW}Em refinamento{CLR_RESET}"
            print(f"  {CLR_BOLD}{label}{CLR_RESET}\n    -> Score Composto: {CLR_BOLD}{res.global_score:5.2f}%{CLR_RESET} [{badge}] Status: {res.status}")
        print(f"\n{CLR_GREEN}✓ Demonstração de convergência até 99.7% SOTA concluída com sucesso.{CLR_RESET}\n")

    @classmethod
    def _run_single_test_case(cls, desc: str, code: str, expected_len: int, audit_fn: Callable[[str, str], List[Tuple[int, str]]], path: str) -> bool:
        stubs = audit_fn(code, path)
        ok = len(stubs) == expected_len
        bullet = f"{CLR_GREEN}✓{CLR_RESET}" if ok else f"{CLR_RED}✖{CLR_RESET}"
        status_msg = f"({len(stubs)} stub{'s' if len(stubs) != 1 else ''})"
        action = "ignorado" if expected_len == 0 else "detectado"
        print(f"  {bullet} {desc} {action} {status_msg}")
        return ok

    @classmethod
    def _test_ast_and_lexical_stub_detector(cls) -> bool:
        print(f"\n{CLR_BOLD}{CLR_BLUE}{'=' * 84}{CLR_RESET}")
        print(f"{CLR_BOLD}{CLR_WHITE}  VALIDAÇÃO DOS COMPILADORES AST & LEXER (ZERO FALSOS POSITIVOS){CLR_RESET}")
        print(f"{CLR_BOLD}{CLR_BLUE}{'=' * 84}{CLR_RESET}\n")

        cases = [
            ("AST Python: 'except Exception: pass'", "try:\n    value = int('42')\nexcept Exception:\n    pass\n", 0, CodeStubAuditor.audit_python, "test_except.py"),
            ("AST Python: 'def foo(): pass'", "def uncompleted_handler():\n    pass\n", 1, CodeStubAuditor.audit_python, "test_pass.py"),
            ("AST Python: 'TODO'/'pass' dentro de ast.Constant/regexes", 'import re\nSTUB_RX = re.compile(r"TODO|FIXME|pass")\nDOC = """Este docstring contém TODO e pass sem ser stub."""\nmsg = "Nenhum TODO aqui"\n', 0, CodeStubAuditor.audit_python, "test_strings.py"),
            ("AST Python: comentário '# TODO'", "# TODO: refatorar lógica de validação\nx = 10\n", 1, CodeStubAuditor.audit_python, "test_comment.py"),
            ("Lexer TS/JS: 'TODO' dentro de strings e regexes", "const banner = 'TODO: not a real stub';\nconst pattern = /TODO|FIXME/gi;\nconst template = `URL: /api/TODO/${id}`;\n", 0, CodeStubAuditor.audit_javascript_typescript, "test.ts"),
            ("Lexer TS/JS: comentário '// TODO'", "// TODO: implementar endpoint GraphQL\nexport const handler = () => {};\n", 1, CodeStubAuditor.audit_javascript_typescript, "test.ts"),
        ]
        all_ok = all(cls._run_single_test_case(desc, code, exp, fn, path) for desc, code, exp, fn, path in cases)
        if all_ok:
            print(f"\n{CLR_GREEN}✓ Todas as verificações de AST e Lexer foram concluídas com sucesso.{CLR_RESET}\n")
        return all_ok

    @classmethod
    def run_all(cls) -> bool:
        print(f"\n{CLR_BOLD}{CLR_MAGENTA}{'=' * 84}{CLR_RESET}")
        print(f"{CLR_BOLD}{CLR_WHITE}  HARNESS DE TESTES & BENCHMARK AQEI: DEMONSTRAÇÃO SINTÉTICA{CLR_RESET}")
        print(f"{CLR_BOLD}{CLR_MAGENTA}{'=' * 84}{CLR_RESET}\n")

        s1 = cls._scenario_perfect_session()
        print(AnsiReporter.render_aqei_result(s1, "CENÁRIO 1: SESSÃO PERFEITA (SOTA 99%+)"))
        s2 = cls._scenario_stubbed_session()
        print(AnsiReporter.render_aqei_result(s2, "CENÁRIO 2: SESSÃO COM STUBS E PLACEHOLDERS (TODO/PASS)"))
        s3 = cls._scenario_looping_session()
        print(AnsiReporter.render_aqei_result(s3, "CENÁRIO 3: SESSÃO COM GAGUEIRA E LOOP DE COMANDOS"))
        s4 = cls._scenario_token_bloat_session()
        print(AnsiReporter.render_aqei_result(s4, "CENÁRIO 4: SESSÃO COM INCHAÇO DE TOKENS E ZERO CACHE"))

        cls._demonstrate_refinement_cycle()
        ast_ok = cls._test_ast_and_lexical_stub_detector()

        p1 = s1.global_score >= 99.0
        p2 = s2.global_score < 90.0 and s2.dimensions[2].score <= 60.0
        p3 = s3.dimensions[0].score < 80.0
        p4 = s4.dimensions[1].score < 85.0
        return p1 and p2 and p3 and p4 and ast_ok

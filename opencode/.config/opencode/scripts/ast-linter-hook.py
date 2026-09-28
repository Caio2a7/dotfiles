#!/usr/bin/env python3
"""ast-linter-hook.py - AST and modularity linter hook for Git and CI/CD."""

from __future__ import annotations
import ast
import os
import re
import sys
from pathlib import Path
from typing import List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from aqei.auditor import CodeStubAuditor
except ImportError:
    CodeStubAuditor = None

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"


def check_file_size(lines: List[str], path: str) -> List[str]:
    count = len(lines)
    if count > 300:
        return [
            f"{RED}Violação de Modularidade:{RESET} {path} tem {count} linhas (limite: 300)"
        ]
    return []


def check_python_ast(content: str, path: str) -> List[str]:
    errors = []
    try:
        tree = ast.parse(content, filename=path)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                start = node.lineno
                end = getattr(node, "end_lineno", start + len(node.body))
                length = (end - start) + 1
                if length > 40:
                    errors.append(
                        f"{RED}Função Longa:{RESET} '{node.name}' em {path}:{start} tem {length} linhas (limite: 40)"
                    )
    except SyntaxError as se:
        errors.append(f"{RED}Erro de Sintaxe AST:{RESET} {path}:{se.lineno} {se.msg}")
    return errors


def check_js_ts_functions(lines: List[str], path: str) -> List[str]:
    errors = []
    pattern = re.compile(
        r"^\s*(?:export\s+)?(?:async\s+)?(?:function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\()"
    )
    name, start, depth = None, 0, 0
    for idx, line in enumerate(lines, start=1):
        if name is None:
            m = pattern.search(line)
            if m and "{" in line:
                name, start = next((g for g in m.groups() if g), "anonymous"), idx
                depth = line.count("{") - line.count("}")
        else:
            depth += line.count("{") - line.count("}")
            if depth <= 0:
                length = idx - start + 1
                if length > 40:
                    errors.append(
                        f"{RED}Função Longa:{RESET} '{name}' em {path}:{start} tem {length} linhas (limite: 40)"
                    )
                name, depth = None, 0
    return errors


def check_stubs(content: str, path: str) -> List[str]:
    if CodeStubAuditor is None:
        return []
    stubs = CodeStubAuditor.audit_content(content, path)
    return [
        f"{YELLOW}Stub Detectado:{RESET} {path}:{line} -> {desc}"
        for line, desc in stubs
    ]


def lint_file(file_path: str) -> List[str]:
    p = Path(file_path)
    if not p.is_file():
        return [f"{RED}Arquivo não encontrado:{RESET} {file_path}"]
    try:
        content = p.read_text(encoding="utf-8", errors="replace")
    except Exception as err:
        return [f"{RED}Falha ao ler:{RESET} {file_path} ({err})"]
    lines = content.splitlines()
    ext = p.suffix.lower()
    errors = check_file_size(lines, file_path)
    if ext == ".py":
        errors.extend(check_python_ast(content, file_path))
    elif ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"):
        errors.extend(check_js_ts_functions(lines, file_path))
    errors.extend(check_stubs(content, file_path))
    return errors


def main() -> int:
    args = sys.argv[1:]
    if not args or "-h" in args or "--help" in args:
        print("Uso: ast-linter-hook.py [--verbose|-v] <arquivo1> [arquivo2 ...]")
        return 0
    verbose = "-v" in args or "--verbose" in args
    files = [f for f in args if f not in ("-v", "--verbose")]
    all_errors = []
    for f in files:
        errs = lint_file(f)
        if errs:
            all_errors.extend(errs)
        elif verbose:
            print(f"{GREEN}✓ Conforme:{RESET} {f}")
    if all_errors:
        print(
            f"\n{BOLD}{RED}✖ Falha na Validação AST/Modularidade ({len(all_errors)} problemas):{RESET}"
        )
        for err in all_errors:
            print(f"  • {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""auditor.py - AST and lexical code stub and directory auditor."""
from __future__ import annotations
import ast
import os
from pathlib import Path
import re
from typing import Dict, List, Optional, Set, Tuple
from aqei.models import (
    AuditViolation, DirectoryAuditReport, IGNORED_DIRS,
    MAX_FILE_LINES, MAX_FUNCTION_LINES, SOURCE_EXTENSIONS, STUB_REGEX,
)

class CodeStubAuditor:
    """AST-driven and lexical code stub auditor eliminating false positives."""

    @staticmethod
    def _skip_comment(content: str, i: int, n: int) -> int:
        if content[i] == "/" and i + 1 < n:
            if content[i + 1] == "/":
                i += 2
                while i < n and content[i] != "\n":
                    i += 1
                return i
            if content[i + 1] == "*":
                i += 2
                while i + 1 < n and not (content[i] == "*" and content[i + 1] == "/"):
                    i += 1
                return i + 2 if i + 1 < n else n
        return i

    @staticmethod
    def _mask_quote(content: str, out: List[str], i: int, n: int, quote: str) -> int:
        start, i = i, i + 1
        while i < n:
            if content[i] == "\\":
                i += 2
                continue
            if content[i] == quote:
                i += 1
                break
            if quote != "`" and content[i] == "\n":
                break
            i += 1
        for k in range(start, min(i, n)):
            if out[k] != "\n":
                out[k] = " "
        return i

    @staticmethod
    def _mask_regex(content: str, out: List[str], i: int, n: int) -> int:
        start, i, in_cc = i, i + 1, False
        while i < n:
            if content[i] == "\\":
                i += 2
                continue
            if content[i] == "[":
                in_cc = True
            elif content[i] == "]":
                in_cc = False
            elif content[i] == "/" and not in_cc:
                i += 1
                while i < n and content[i].isalpha():
                    i += 1
                break
            elif content[i] == "\n":
                break
            i += 1
        for k in range(start, min(i, n)):
            if out[k] != "\n":
                out[k] = " "
        return i

    @classmethod
    def mask_js_ts_strings_and_regexes(cls, content: str) -> str:
        out, n, i = list(content), len(content), 0
        last_sig, last_word, curr_word = "", "", []
        reg_chars = set("([{:;,=!?&|^~+-*%<>")
        reg_kw = {"return", "case", "throw", "yield", "await", "typeof", "void", "delete", "default"}
        while i < n:
            c = content[i]
            skipped_i = cls._skip_comment(content, i, n)
            if skipped_i != i:
                i, last_word, curr_word = skipped_i, "", []
                continue
            if c in ("'", '"', "`"):
                i = cls._mask_quote(content, out, i, n, c)
                last_sig, last_word, curr_word = c, "", []
                continue
            if c == "/":
                can_regex = not last_sig or last_sig in reg_chars or last_word in reg_kw
                i = cls._mask_regex(content, out, i, n) if can_regex else (i + 1)
                last_sig, last_word, curr_word = "/", "", []
                continue
            if c.isalnum() or c == "_":
                curr_word.append(c)
            else:
                last_word = "".join(curr_word) if curr_word else last_word
                curr_word = []
                if not c.isspace():
                    last_sig = c
            i += 1
        return "".join(out)

    @staticmethod
    def _is_in_except(node: ast.AST, parent_map: Dict[ast.AST, ast.AST]) -> bool:
        curr = parent_map.get(node)
        while curr is not None:
            if isinstance(curr, ast.ExceptHandler):
                return True
            curr = parent_map.get(curr)
        return False

    @classmethod
    def _find_pass_stubs(cls, tree: ast.AST, parent_map: Dict[ast.AST, ast.AST]) -> Tuple[Set[int], List[Tuple[int, str]]]:
        lines, stubs = set(), []
        for n in ast.walk(tree):
            if isinstance(n, ast.Pass) and not cls._is_in_except(n, parent_map):
                lines.add(n.lineno)
                stubs.append((n.lineno, "Stub detectado: 'pass' fora de except handler (placeholder)"))
        return lines, stubs

    @staticmethod
    def _mask_range(line_chars: List[List[str]], l_idx: int, c_start: int, c_end: int) -> None:
        if 0 <= l_idx < len(line_chars):
            for c in range(c_start, min(c_end, len(line_chars[l_idx]))):
                if line_chars[l_idx][c] != "\n":
                    line_chars[l_idx][c] = " "

    @classmethod
    def _mask_ast_constants(cls, tree: ast.AST, line_chars: List[List[str]]) -> None:
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, (str, bytes)):
                s_l, s_c = node.lineno - 1, node.col_offset
                e_l = getattr(node, "end_lineno", node.lineno) - 1
                e_c = getattr(node, "end_col_offset", None)
                if s_l == e_l:
                    cls._mask_range(line_chars, s_l, s_c, e_c if e_c is not None else 1000000)
                else:
                    cls._mask_range(line_chars, s_l, s_c, 1000000)
                    for mid in range(s_l + 1, min(e_l, len(line_chars))):
                        cls._mask_range(line_chars, mid, 0, 1000000)
                    if e_c is not None:
                        cls._mask_range(line_chars, e_l, 0, e_c)

    @classmethod
    def audit_python(cls, content: str, file_path: str = "") -> List[Tuple[int, str]]:
        try:
            tree = ast.parse(content, filename=file_path or "<snippet>")
        except SyntaxError:
            return cls._audit_fallback(content)
        parent_map: Dict[ast.AST, ast.AST] = {}
        for p in ast.walk(tree):
            for ch in ast.iter_child_nodes(p):
                parent_map[ch] = p
        pass_lines, stubs = cls._find_pass_stubs(tree, parent_map)
        raw_lines = content.splitlines(keepends=True)
        if not raw_lines:
            return stubs
        line_chars = [list(l) for l in raw_lines]
        cls._mask_ast_constants(tree, line_chars)
        pattern = re.compile(r"(?i)\b(TODO|FIXME|XXX|HACK)\b|\.\.\.add\s+logic|NotImplementedError")
        for idx, chars in enumerate(line_chars, start=1):
            m = pattern.search("".join(chars))
            if m and idx not in pass_lines:
                orig_line = raw_lines[idx - 1].strip() if idx - 1 < len(raw_lines) else ""
                stubs.append((idx, f"Stub detectado: {m.group(0)} em '{orig_line}'"))
        stubs.sort(key=lambda s: s[0])
        return stubs

    @classmethod
    def audit_javascript_typescript(cls, content: str, file_path: str = "") -> List[Tuple[int, str]]:
        masked = cls.mask_js_ts_strings_and_regexes(content)
        pattern, stubs = re.compile(r"(?i)\b(TODO|FIXME|XXX|HACK)\b|\.\.\.add\s+logic|NotImplementedError"), []
        for idx, (mline, rline) in enumerate(zip(masked.splitlines(), content.splitlines()), start=1):
            m = pattern.search(mline)
            if m:
                stubs.append((idx, f"Stub detectado: {m.group(0)} em '{rline.strip()}'"))
        return stubs

    @classmethod
    def audit_generic_c_style(cls, content: str, file_path: str = "") -> List[Tuple[int, str]]:
        out, n, i = list(content), len(content), 0
        while i < n:
            skipped = cls._skip_comment(content, i, n)
            if skipped != i:
                i = skipped
                continue
            if content[i] in ('"', "'", "`"):
                i = cls._mask_quote(content, out, i, n, content[i])
                continue
            i += 1
        pattern, stubs = re.compile(r"(?i)\b(TODO|FIXME|XXX|HACK)\b|\.\.\.add\s+logic|NotImplementedError"), []
        for idx, (mline, rline) in enumerate(zip("".join(out).splitlines(), content.splitlines()), start=1):
            m = pattern.search(mline)
            if m:
                stubs.append((idx, f"Stub detectado: {m.group(0)} em '{rline.strip()}'"))
        return stubs

    @classmethod
    def audit_content(cls, content: str, file_path: str = "") -> List[Tuple[int, str]]:
        ext = Path(file_path).suffix.lower() if file_path else ""
        if ext == ".py":
            return cls.audit_python(content, file_path)
        if ext in (".ts", ".tsx", ".js", ".jsx"):
            return cls.audit_javascript_typescript(content, file_path)
        if ext in (".go", ".rs", ".java", ".c", ".cpp", ".h"):
            return cls.audit_generic_c_style(content, file_path)
        try:
            ast.parse(content)
            return cls.audit_python(content, file_path)
        except Exception:
            return cls.audit_generic_c_style(content, file_path)

    @classmethod
    def _audit_fallback(cls, content: str) -> List[Tuple[int, str]]:
        stubs: List[Tuple[int, str]] = []
        for idx, line in enumerate(content.splitlines(), start=1):
            if STUB_REGEX.search(line):
                stubs.append((idx, f"Stub detectado: {line.strip()}"))
        return stubs

class DirectoryAuditor:
    """Static code audit engine checking stubs, size limits, and AST syntax."""

    @staticmethod
    def _collect_files(root: Path) -> List[Path]:
        if root.is_file():
            return [root]
        res: List[Path] = []
        for cr, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
            res.extend(Path(cr) / fn for fn in files if (Path(cr) / fn).suffix.lower() in SOURCE_EXTENSIONS)
        return res

    @classmethod
    def _check_python_functions(cls, content: str, rel: str, fns_over: List[Tuple[str, str, int]], viols: List[AuditViolation], syn_errs: List[Tuple[str, str]]) -> None:
        try:
            tree = ast.parse(content, filename=rel)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    fn_start = node.lineno
                    fn_end = getattr(node, "end_lineno", fn_start + len(node.body))
                    fn_len = (fn_end - fn_start) + 1
                    if fn_len > MAX_FUNCTION_LINES:
                        fns_over.append((rel, node.name, fn_len))
                        viols.append(AuditViolation(rel, fn_start, "FUNCTION_LENGTH", f"Função '{node.name}' com {fn_len} linhas (limite: {MAX_FUNCTION_LINES})"))
        except SyntaxError as se:
            syn_errs.append((rel, str(se)))
            viols.append(AuditViolation(rel, se.lineno or 1, "SYNTAX_ERROR", f"Erro de sintaxe Python: {se.msg}"))

    @staticmethod
    def _audit_generic_function_length(lines: List[str], rel: str, fns_over: List[Tuple[str, str, int]], viols: List[AuditViolation]) -> None:
        pattern = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?(?:function\s+([a-zA-Z0-9_]+)|func\s+(?:\([^\)]+\)\s+)?([a-zA-Z0-9_]+)|fn\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\()")
        current_name, start_line, depth = None, 0, 0
        for idx, line in enumerate(lines, start=1):
            if current_name is None:
                m = pattern.search(line)
                if m and "{" in line:
                    current_name, start_line = next((g for g in m.groups() if g), "anonymous"), idx
                    depth = line.count("{") - line.count("}")
            else:
                depth += line.count("{") - line.count("}")
                if depth <= 0:
                    fn_len = idx - start_line + 1
                    if fn_len > MAX_FUNCTION_LINES:
                        fns_over.append((rel, current_name, fn_len))
                        viols.append(AuditViolation(rel, start_line, "FUNCTION_LENGTH", f"Função '{current_name}' com {fn_len} linhas (limite: {MAX_FUNCTION_LINES})"))
                    current_name, depth = None, 0

    @classmethod
    def audit(cls, target_path: str) -> DirectoryAuditReport:
        root = Path(target_path).resolve()
        if not root.exists():
            raise FileNotFoundError(f"Caminho não encontrado: {target_path}")
        files = cls._collect_files(root)
        total_lines, stubs_count = 0, 0
        files_over, fns_over, syntax_errs, violations = [], [], [], []
        for p in files:
            try:
                content = p.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            lines, rel = content.splitlines(), str(p)
            line_cnt = len(lines)
            total_lines += line_cnt
            if line_cnt > MAX_FILE_LINES:
                files_over.append((rel, line_cnt))
                violations.append(AuditViolation(rel, line_cnt, "FILE_LENGTH", f"Arquivo com {line_cnt} linhas (limite: {MAX_FILE_LINES})"))
            stubs = CodeStubAuditor.audit_content(content, rel)
            stubs_count += len(stubs)
            for s_line, s_desc in stubs:
                violations.append(AuditViolation(rel, s_line, "CODE_STUB", s_desc))
            if p.suffix.lower() == ".py":
                cls._check_python_functions(content, rel, fns_over, violations, syntax_errs)
            else:
                cls._audit_generic_function_length(lines, rel, fns_over, violations)
        return DirectoryAuditReport(len(files), total_lines, stubs_count, files_over, fns_over, syntax_errs, violations)

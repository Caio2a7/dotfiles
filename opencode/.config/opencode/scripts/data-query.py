#!/usr/bin/env python3
"""
data-query.py - Fast in-process analytical query engine using DuckDB.
Queries CSV, JSON, Parquet, and SQLite files directly with zero database setup.
"""

import argparse
import json
import os
import sys

# Ensure uv-managed duckdb or system duckdb is importable
try:
    import duckdb  # type: ignore[import-untyped,import-not-found]
except ImportError:
    # Run under uv if duckdb is not in base python
    import subprocess

    cmd = ["uv", "run", "--with", "duckdb", "python3", __file__] + sys.argv[1:]
    res = subprocess.run(cmd)
    sys.exit(res.returncode)


def format_markdown_table(headers, rows):
    """Formats SQL results into a clean GitHub-flavored Markdown table."""
    if not headers:
        return "*(Nenhum resultado retornado)*"

    col_widths = [len(str(h)) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            str_val = "NULL" if val is None else str(val)
            col_widths[i] = max(col_widths[i], len(str_val))

    # Header
    header_line = (
        "| " + " | ".join(f"{h:<{col_widths[i]}}" for i, h in enumerate(headers)) + " |"
    )
    sep_line = (
        "| " + " | ".join("-" * col_widths[i] for i in range(len(headers))) + " |"
    )

    lines = [header_line, sep_line]
    for row in rows:
        row_str = (
            "| "
            + " | ".join(
                f"{('NULL' if v is None else str(v)):<{col_widths[i]}}"
                for i, v in enumerate(row)
            )
            + " |"
        )
        lines.append(row_str)

    return "\n".join(lines)


def run_query(sql: str, as_json: bool = False):
    """Executes a SQL query directly via DuckDB."""
    try:
        con = duckdb.connect(database=":memory:")
        rel = con.sql(sql)
        if rel is None:
            print("Query executada com sucesso (sem retorno de linhas).")
            return

        headers = [desc[0] for desc in rel.description]
        rows = rel.fetchall()

        if as_json:
            result = [dict(zip(headers, row)) for row in rows]
            print(json.dumps(result, indent=2, default=str))
        else:
            print(format_markdown_table(headers, rows))
            print(f"\n*Total de linhas: {len(rows)}*")
    except Exception as e:
        print(f"Erro na query SQL: {e}", file=sys.stderr)
        sys.exit(1)


def inspect_schema(file_path: str):
    """Inspects file schema and sample rows."""
    if not os.path.exists(file_path):
        print(f"Erro: Arquivo não encontrado: {file_path}", file=sys.stderr)
        sys.exit(1)

    sql = f"DESCRIBE SELECT * FROM '{file_path}';"
    print(f"### 📋 Esquema de Dados: `{file_path}`\n")
    run_query(sql, as_json=False)

    print(f"\n### 🔍 Amostra de Dados (Primeiras 3 linhas):\n")
    sample_sql = f"SELECT * FROM '{file_path}' LIMIT 3;"
    run_query(sample_sql, as_json=False)


def summarize_file(file_path: str):
    """Generates statistical summary of numerical and categorical columns."""
    if not os.path.exists(file_path):
        print(f"Erro: Arquivo não encontrado: {file_path}", file=sys.stderr)
        sys.exit(1)

    sql = f"SUMMARIZE SELECT * FROM '{file_path}';"
    print(f"### 📊 Sumário Estatístico: `{file_path}`\n")
    run_query(sql, as_json=False)


def main():
    parser = argparse.ArgumentParser(description="DuckDB In-Process Fast Data Engine")
    subparsers = parser.add_subparsers(dest="command", help="Comando a executar")

    # query
    query_parser = subparsers.add_parser(
        "query", help="Executa uma consulta SQL direta"
    )
    query_parser.add_argument("sql", help="Comando SQL a ser executado")
    query_parser.add_argument(
        "--json", action="store_true", help="Retorna em formato JSON"
    )

    # schema
    schema_parser = subparsers.add_parser(
        "schema", help="Inspeciona colunas e tipos de um arquivo"
    )
    schema_parser.add_argument(
        "file", help="Caminho para arquivo CSV, Parquet, JSON ou SQLite"
    )

    # summary
    summary_parser = subparsers.add_parser(
        "summary", help="Gera sumário estatístico de um arquivo"
    )
    summary_parser.add_argument(
        "file", help="Caminho para arquivo CSV, Parquet, JSON ou SQLite"
    )

    # direct query fallback if first arg is not a subcommand
    if len(sys.argv) > 1 and sys.argv[1] not in [
        "query",
        "schema",
        "summary",
        "-h",
        "--help",
    ]:
        run_query(sys.argv[1])
        return

    args = parser.parse_args()

    if args.command == "query":
        run_query(args.sql, as_json=args.json)
    elif args.command == "schema":
        inspect_schema(args.file)
    elif args.command == "summary":
        summarize_file(args.file)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
perf-bench.py - Empirical performance benchmarking and load testing utility.
Integrates Hyperfine (CLI/execution timing) and Autocannon (HTTP latency and throughput).
"""

import argparse
import json
import os
import shutil
import subprocess
import sys


def is_tool_available(name: str) -> bool:
    return shutil.which(name) is not None


def benchmark_cli(commands: list, warmup: int = 2, runs: int = 5):
    """Runs statistical CLI benchmarking using Hyperfine."""
    print("### ⚡ Benchmark de Execução CLI (Hyperfine)\n")
    if not is_tool_available("hyperfine"):
        print("⚠️ `hyperfine` não encontrado no PATH.")
        return

    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
        json_out = tf.name

    try:
        cmd = [
            "hyperfine",
            "--warmup",
            str(warmup),
            "--runs",
            str(runs),
            "--export-json",
            json_out,
        ] + commands
        subprocess.run(cmd, check=True)

        if os.path.exists(json_out) and os.path.getsize(json_out) > 0:
            with open(json_out, "r", encoding="utf-8") as f:
                data = json.load(f)

            results = data.get("results", [])
            if not results:
                print("Nenhum resultado de benchmark retornado.")
                return

            print(
                "\n| Comando | Média (Mean) | Mínimo (Min) | Máximo (Max) | Desvio (StdDev) |"
            )
            print("| :--- | :---: | :---: | :---: | :---: |")
            for r in results:
                c = r.get("command", "")
                mean_s = f"{r.get('mean', 0) * 1000:.2f} ms"
                min_s = f"{r.get('min', 0) * 1000:.2f} ms"
                max_s = f"{r.get('max', 0) * 1000:.2f} ms"
                std_s = f"{r.get('stddev', 0) * 1000:.2f} ms"
                print(f"| `{c}` | **{mean_s}** | {min_s} | {max_s} | {std_s} |")
    except Exception as e:
        print(f"⚠️ Erro ao executar hyperfine: {e}")
    finally:
        if os.path.exists(json_out):
            try:
                os.remove(json_out)
            except Exception:
                pass


def benchmark_http(
    url: str, connections: int = 10, duration: int = 5, pipelining: int = 1
):
    """Runs HTTP throughput and latency percentile testing using Autocannon."""
    print(f"### 🌐 Teste de Carga & Latência HTTP: `{url}`\n")
    cmd = [
        "npx",
        "-y",
        "autocannon",
        "-c",
        str(connections),
        "-d",
        str(duration),
        "-p",
        str(pipelining),
        "-j",
        "--latency",
        url,
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 and not res.stdout.strip():
        print(f"⚠️ Falha no teste HTTP:\n{res.stderr}")
        return

    try:
        # Autocannon prints progress or single json
        lines = [
            line.strip()
            for line in res.stdout.strip().splitlines()
            if line.strip().startswith("{")
        ]
        if not lines:
            print(res.stdout)
            return

        data = json.loads(lines[-1])
        reqs = data.get("requests", {})
        lat = data.get("latency", {})

        print("| Métrica | Valor Obtido |")
        print("| :--- | :---: |")
        print(
            f"| **Taxa Média de Requisições** | `{reqs.get('average', 0):.1f} reqs/seg` |"
        )
        print(
            f"| **Total de Requisições Feitas** | `{reqs.get('total', 0)}` em {duration}s |"
        )
        print(
            f"| **Throughput de Rede** | `{data.get('throughput', {}).get('average', 0) / 1024 / 1024:.2f} MB/seg` |"
        )
        print(
            f"| **Erros 4xx / 5xx / Timeouts** | `{data.get('non2xx', 0)} / {data.get('timeouts', 0)}` |"
        )
        print("")
        print("#### ⏱️ Distribuição de Latência (Percentis)")
        print("| Percentil | Latência |")
        print("| :--- | :---: |")
        print(
            f"| **Mínima / Média** | `{lat.get('min', 0):.2f} ms` / `{lat.get('average', 0):.2f} ms` |"
        )
        print(f"| **p50 (Mediana)** | `{lat.get('p50', 0):.2f} ms` |")
        print(f"| **p90** | `{lat.get('p90', 0):.2f} ms` |")
        print(f"| **p97.5** | `{lat.get('p97_5', 0):.2f} ms` |")
        print(f"| **p99 (Cauda Longa)** | `{lat.get('p99', 0):.2f} ms` |")
        print(f"| **Máxima** | `{lat.get('max', 0):.2f} ms` |")
    except Exception as e:
        print(f"⚠️ Erro ao processar relatório do Autocannon: {e}")
        print(res.stdout[:400])


def main():
    parser = argparse.ArgumentParser(
        description="Empirical Performance Benchmarker (Hyperfine & Autocannon)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Tipo de benchmark")

    # cli
    p_cli = subparsers.add_parser(
        "cli", help="Benchmark estatístico de comandos de terminal"
    )
    p_cli.add_argument(
        "--cmd", action="append", required=True, help="Comando a testar (pode repetir)"
    )
    p_cli.add_argument(
        "--warmup", type=int, default=2, help="Número de execuções de aquecimento"
    )
    p_cli.add_argument("--runs", type=int, default=5, help="Número de medições")

    # http
    p_http = subparsers.add_parser(
        "http", help="Teste de carga HTTP e percentis de latência"
    )
    p_http.add_argument("url", help="URL do endpoint a ser testado")
    p_http.add_argument(
        "-c", "--connections", type=int, default=10, help="Conexões concorrentes"
    )
    p_http.add_argument(
        "-d", "--duration", type=int, default=5, help="Duração do teste em segundos"
    )
    p_http.add_argument(
        "-p", "--pipelining", type=int, default=1, help="Fator de pipelining"
    )

    args = parser.parse_args()

    if args.command == "cli":
        benchmark_cli(args.cmd, warmup=args.warmup, runs=args.runs)
    elif args.command == "http":
        benchmark_http(
            args.url,
            connections=args.connections,
            duration=args.duration,
            pipelining=args.pipelining,
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
sec-scan.py - Unified Application Security (AppSec) Scanner for OpenCode.
Combines Gitleaks (Secrets), Semgrep (SAST), and OSV-Scanner (CVEs / Dependencies).
"""

import argparse
import json
import os
import shutil
import subprocess
import sys


def is_tool_available(name: str) -> bool:
    return shutil.which(name) is not None


def run_secrets_scan(target_path: str):
    """Audits target for secrets, API keys, and credentials using Gitleaks."""
    print("### 🔑 Auditoria de Segredos & Credenciais (Gitleaks)\n")
    if not is_tool_available("gitleaks"):
        print("⚠️ `gitleaks` não encontrado no PATH.")
        return

    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
        report_file = tf.name

    try:
        is_git_repo = os.path.exists(os.path.join(target_path, ".git"))
        cmd = [
            "gitleaks",
            "detect",
            "--report-format",
            "json",
            "--report-path",
            report_file,
        ]
        if not is_git_repo:
            cmd.extend(["--no-git", "--source", target_path])

        res = subprocess.run(cmd, capture_output=True, text=True)

        if res.returncode == 0:
            print("✅ **Nenhum segredo ou credencial exposta** foi detectado.")
            return

        if os.path.exists(report_file) and os.path.getsize(report_file) > 0:
            with open(report_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not data:
                print("✅ **Nenhum segredo ou credencial exposta** foi detectado.")
                return

            print(f"🚨 **{len(data)} vazamento(s) de segredo(s) detectado(s):**\n")
            print("| Regra | Arquivo | Linha | Chave Ofuscada |")
            print("| :--- | :--- | :---: | :--- |")
            for item in data[:20]:
                rule = item.get("RuleID", "Secret")
                file_name = item.get("File", "")
                line = item.get("StartLine", "")
                secret = item.get("Secret", "")
                masked = secret[:3] + "..." + secret[-3:] if len(secret) > 6 else "***"
                print(f"| `{rule}` | `{file_name}` | {line} | `{masked}` |")
        else:
            print("⚠️ Alerta de segredo detectado pelo Gitleaks.")
    except Exception as e:
        print(f"⚠️ Erro ao processar relatório do Gitleaks: {e}")
    finally:
        if os.path.exists(report_file):
            try:
                os.remove(report_file)
            except Exception:
                pass


def run_sast_scan(target_path: str):
    """Performs Static Application Security Testing (SAST) using Semgrep."""
    print("\n### 🛡️ Análise Estática de Vulnerabilidades (Semgrep SAST)\n")
    if not is_tool_available("semgrep"):
        print("⚠️ `semgrep` não encontrado no PATH.")
        return

    cmd = [
        "semgrep",
        "scan",
        "--config",
        "auto",
        "--json",
        "--metrics=off",
        "--quiet",
        target_path,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)

    try:
        data = json.loads(res.stdout) if res.stdout.strip() else {}
        results = data.get("results", [])

        if not results:
            print(
                "✅ **Nenhuma vulnerabilidade estática (SAST) de alto risco** detectada pelas regras ativas."
            )
            return

        print(f"⚠️ **{len(results)} apontamento(s) de segurança identificados:**\n")
        print("| Severidade | Regra / CWE | Arquivo | Linha | Mensagem |")
        print("| :---: | :--- | :--- | :---: | :--- |")

        for item in results[:25]:
            extra = item.get("extra", {})
            sev = extra.get("severity", "WARNING").upper()
            badge = "🔴" if sev == "ERROR" else "🟡"
            check_id = item.get("check_id", "").split(".")[-1]
            path = item.get("path", "")
            start = item.get("start", {}).get("line", "")
            msg = extra.get("message", "").strip().replace("\n", " ")[:80]
            print(f"| {badge} {sev} | `{check_id}` | `{path}` | {start} | {msg} |")
    except Exception as e:
        print(f"⚠️ Falha ao processar saída do Semgrep: {e}")


def run_deps_scan(target_path: str):
    """Scans dependencies for known CVEs using OSV-Scanner."""
    print("\n### 📦 Auditoria de Dependências & CVEs (OSV-Scanner)\n")
    if not is_tool_available("osv-scanner"):
        print("⚠️ `osv-scanner` não encontrado no PATH.")
        return

    cmd = ["osv-scanner", "scan", "source", "-r", "--format", "json", target_path]
    res = subprocess.run(cmd, capture_output=True, text=True)

    try:
        data = json.loads(res.stdout) if res.stdout.strip() else {}
        results = data.get("results", [])

        total_vulns = 0
        vuln_rows = []

        for r in results:
            for pkg in r.get("packages", []):
                pname = pkg.get("package", {}).get("name", "")
                pver = pkg.get("package", {}).get("version", "")
                for vuln in pkg.get("vulnerabilities", []):
                    total_vulns += 1
                    vid = vuln.get("id", "CVE")
                    summary = (
                        (vuln.get("summary") or vuln.get("details") or "")
                        .strip()
                        .replace("\n", " ")[:70]
                    )
                    vuln_rows.append((vid, pname, pver, summary))

        if total_vulns == 0:
            print(
                "✅ **Nenhuma CVE conhecida** encontrada nos manifests e lockfiles inspecionados."
            )
            return

        print(
            f"🚨 **{total_vulns} vulnerabilidade(s) de dependência(s) detectada(s):**\n"
        )
        print("| ID (CVE / GHSA) | Pacote | Versão Atual | Resumo |")
        print("| :--- | :--- | :---: | :--- |")
        for vid, pname, pver, summary in vuln_rows[:25]:
            print(f"| `{vid}` | `{pname}` | `{pver}` | {summary} |")
    except Exception as e:
        print(f"⚠️ Falha ao processar saída do OSV-Scanner: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Unified AppSec Scanner (Semgrep, Gitleaks, OSV)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Comando de auditoria")

    p_sec = subparsers.add_parser("secrets", help="Varredura de segredos com Gitleaks")
    p_sec.add_argument(
        "path", nargs="?", default=".", help="Caminho do repositório/pasta"
    )

    p_sast = subparsers.add_parser(
        "sast", help="Análise estática de código com Semgrep"
    )
    p_sast.add_argument(
        "path", nargs="?", default=".", help="Caminho do repositório/pasta"
    )

    p_deps = subparsers.add_parser("deps", help="Auditoria de CVEs com OSV-Scanner")
    p_deps.add_argument(
        "path", nargs="?", default=".", help="Caminho do repositório/pasta"
    )

    p_all = subparsers.add_parser(
        "all", help="Executa auditoria completa (Secrets + SAST + CVEs)"
    )
    p_all.add_argument(
        "path", nargs="?", default=".", help="Caminho do repositório/pasta"
    )

    if len(sys.argv) == 1:
        run_secrets_scan(".")
        run_sast_scan(".")
        run_deps_scan(".")
        return

    args = parser.parse_args()

    if args.command == "secrets":
        run_secrets_scan(args.path)
    elif args.command == "sast":
        run_sast_scan(args.path)
    elif args.command == "deps":
        run_deps_scan(args.path)
    elif args.command == "all":
        run_secrets_scan(args.path)
        run_sast_scan(args.path)
        run_deps_scan(args.path)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Semantic code search using Ollama embeddings (nomic-embed-text) on local GPU."""

import argparse
from dataclasses import asdict, dataclass
import json
import math
import os
import sys
from typing import List, Optional, Tuple
import urllib.request

OLLAMA_URL = "http://127.0.0.1:11434/api/embeddings"
MODEL_NAME = "nomic-embed-text"


@dataclass
class CodeChunk:
    file_path: str
    start_line: int
    end_line: int
    content: str
    embedding: Optional[List[float]] = None


def get_embedding(text: str) -> List[float]:
    payload = json.dumps({"model": MODEL_NAME, "prompt": text}).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["embedding"]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    return dot / (norm1 * norm2) if norm1 and norm2 else 0.0


def chunk_file(file_path: str, max_chunk_lines: int = 30) -> List[CodeChunk]:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception:
        return []
    chunks: List[CodeChunk] = []
    total = len(lines)
    i = 0
    while i < total:
        end = min(i + max_chunk_lines, total)
        for j in range(i + 15, end):
            l = lines[j].lstrip()
            if l.startswith(("def ", "class ", "function ", "func ", "export func")):
                end = j
                break
        chunk_text = "".join(lines[i:end]).strip()
        if chunk_text:
            chunks.append(CodeChunk(file_path, i + 1, end, chunk_text))
        i = end
    return chunks


def collect_files(target_dir: str) -> List[str]:
    exts = {".py", ".ts", ".js", ".go"}
    ignore = {
        ".git",
        "node_modules",
        "dist",
        "build",
        "__pycache__",
        ".venv",
        "venv",
        ".aiflow",
    }
    code_files: List[str] = []
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in ignore]
        for f in files:
            if os.path.splitext(f)[1] in exts:
                code_files.append(os.path.join(root, f))
    return code_files


def get_index_path(base_dir: str) -> str:
    aiflow = os.path.join(base_dir, ".aiflow")
    if os.path.isdir(aiflow):
        return os.path.join(aiflow, "code-embeddings.json")
    return os.path.join(base_dir, ".code-embeddings.json")


def cmd_index(target_dir: str) -> None:
    target_dir = os.path.abspath(target_dir)
    files = collect_files(target_dir)
    print(f"\033[1;34m[INDEX]\033[0m Mapeando {len(files)} arquivos em {target_dir}...")
    all_chunks: List[CodeChunk] = []
    for fp in files:
        all_chunks.extend(chunk_file(fp))
    print(
        f"\033[1;34m[INDEX]\033[0m Gerando embeddings para {len(all_chunks)} blocos..."
    )
    for idx, ch in enumerate(all_chunks, 1):
        try:
            ch.embedding = get_embedding(ch.content)
            if idx % 10 == 0 or idx == len(all_chunks):
                print(f"\033[32m  Progresso: {idx}/{len(all_chunks)}\033[0m", end="\r")
        except Exception as err:
            print(
                f"\n\033[31mErro em {ch.file_path}:{ch.start_line} - {err}\033[0m",
                file=sys.stderr,
            )
    print(f"\n\033[1;32m[DONE]\033[0m Embeddings concluídos.")
    index_file = get_index_path(target_dir)
    os.makedirs(os.path.dirname(index_file), exist_ok=True)
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump([asdict(c) for c in all_chunks if c.embedding], f, indent=2)
    print(f"\033[1;32m[SAVED]\033[0m Índice gravado em: {index_file}")


def load_index(index_path: str) -> List[CodeChunk]:
    if not os.path.exists(index_path):
        alt = (
            os.path.join(os.path.dirname(index_path), ".code-embeddings.json")
            if ".aiflow" in index_path
            else os.path.join(
                os.path.dirname(index_path), ".aiflow", "code-embeddings.json"
            )
        )
        if os.path.exists(alt):
            index_path = alt
        else:
            raise FileNotFoundError(
                f"Índice não encontrado em {index_path}. Execute 'index' primeiro."
            )
    with open(index_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [CodeChunk(**item) for item in data]


def display_results(results: List[Tuple[float, CodeChunk]]) -> None:
    if not results:
        print("\033[33mNenhum resultado encontrado.\033[0m")
        return
    for rank, (score, chunk) in enumerate(results, 1):
        print(
            f"\n\033[1;35m#{rank}\033[0m \033[1;32m[{score:.4f}]\033[0m | "
            f"\033[1;34m{chunk.file_path}:{chunk.start_line}-{chunk.end_line}\033[0m"
        )
        preview = "\n".join(chunk.content.splitlines()[:5])
        print(f"\033[90m{preview}\033[0m")


def cmd_search(query: str, top_k: int = 5, base_dir: str = ".") -> None:
    index_file = get_index_path(os.path.abspath(base_dir))
    try:
        chunks = load_index(index_file)
    except FileNotFoundError as e:
        print(f"\033[31m[ERRO]\033[0m {e}", file=sys.stderr)
        sys.exit(1)
    print(f'\033[1;36m[SEARCH]\033[0m Query: "{query}" (Top-{top_k})')
    q_emb = get_embedding(query)
    scored: List[Tuple[float, CodeChunk]] = []
    for c in chunks:
        if c.embedding:
            score = cosine_similarity(q_emb, c.embedding)
            scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    display_results(scored[:top_k])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Busca semântica vetorial de código na GPU via Ollama (nomic-embed-text)"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    p_idx = sub.add_parser(
        "index", help="Indexa arquivos de código (.py, .ts, .js, .go)"
    )
    p_idx.add_argument(
        "dir", nargs="?", default=".", help="Diretório raiz a ser indexado"
    )
    p_srch = sub.add_parser(
        "search", help="Busca semântica vetorial por query de texto"
    )
    p_srch.add_argument("query", help="Texto ou intenção da busca")
    p_srch.add_argument(
        "--top-k", type=int, default=5, help="Quantidade de resultados (padrão: 5)"
    )
    args = parser.parse_args()
    if args.command == "index":
        cmd_index(args.dir)
    elif args.command == "search":
        cmd_search(args.query, top_k=args.top_k)


if __name__ == "__main__":
    main()

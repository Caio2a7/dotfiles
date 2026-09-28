#!/usr/bin/env bash
# worktree-runner.sh - Isolated execution via Git Worktree (Two-Phase Commit)
set -eo pipefail

if [ "$#" -eq 0 ]; then
  echo "Uso: $0 <comando...>"
  exit 1
fi

REPO_DIR=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_DIR" ]; then
  echo "Erro: O diretório atual não é um repositório git." >&2
  exit 1
fi

WT_PATH="/tmp/opencode-wt-$$"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "HEAD")

cleanup() {
  if [ -d "$WT_PATH" ]; then
    git worktree remove --force "$WT_PATH" >/dev/null 2>&1 || true
    rm -rf "$WT_PATH" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "📦 Criando worktree temporária em $WT_PATH baseada em $CURRENT_BRANCH..."
git worktree add --detach "$WT_PATH" HEAD >/dev/null 2>&1

echo "🚀 Executando tarefa isolada: $*"
set +e
(cd "$WT_PATH" && "$@")
CMD_EXIT=$?
set -e

if [ $CMD_EXIT -eq 0 ]; then
  echo "✅ Tarefa concluída com sucesso (código 0)."
  CHANGES=$(git -C "$WT_PATH" status --porcelain)
  if [ -n "$CHANGES" ]; then
    echo "📋 Alterações detectadas no sandbox:"
    git -C "$WT_PATH" diff --stat
    echo ""
    echo "🔄 Aplicando alterações no repositório de trabalho..."
    git -C "$WT_PATH" diff | git apply --reject --whitespace=fix - || {
      echo "⚠️ Aviso: Conflito ao aplicar patch direto. Sincronize manualmente se necessário."
    }
  else
    echo "ℹ️ Nenhuma alteração de arquivo gerada."
  fi
else
  echo "❌ Falha na execução da tarefa (código $CMD_EXIT)."
  echo "🛡️ Sandbox revertido: O repositório principal permaneceu 100% protegido."
  exit $CMD_EXIT
fi

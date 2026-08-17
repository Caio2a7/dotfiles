#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ~/.config/hypr/scripts/new-task.sh
#
# Bind Hyprland:
#   bindd = SUPER, N, Nova tarefa, exec, ~/.config/hypr/scripts/new-task.sh
#
# Fluxo:
#   1. Walker lista os tópicos (arquivos em ~/vittae/tarefas) capitalizados
#   2. Walker abre input livre para digitar a nova tarefa
#   3. Tarefa é inserida no topo de "Pendentes" no arquivo do tópico (pilha)
# ─────────────────────────────────────────────────────────────────────────────

TASKS_DIR="$HOME/vittae/tarefas"

# ── 1. Listar tópicos capitalizados ──────────────────────────────────────────
selected=$(
  for file in "$TASKS_DIR"/*.md; do
    [ -f "$file" ] || continue
    topic=$(basename "$file" .md)
    echo "${topic^}"        # capitaliza a primeira letra
  done | sort \
       | walker --dmenu --placeholder "󰝰  Selecionar tópico"
)

[ -z "$selected" ] && exit 0

# Mapeia de volta para o arquivo (lowercase)
filename="$TASKS_DIR/${selected,,}.md"

[ ! -f "$filename" ] && {
  notify-send "new-task" "Arquivo não encontrado: $filename" \
    --urgency=critical --icon=dialog-error
  exit 1
}

# ── 2. Input livre da nova tarefa (stdin vazio = campo de texto puro) ─────────
task=$(walker --dmenu --placeholder "  Nova tarefa → $selected" < /dev/null)

[ -z "$task" ] && exit 0

# ── 3. Inserir no topo de Pendentes (comportamento de pilha) ─────────────────
#
# Estrutura esperada no arquivo .md:
#
#   # Tarefas
#   > [!WARNING] Urgente
#
#   > [!IMPORTANT] Pendentes
#   > - [] tarefa existente          ← novas entram ACIMA desta linha
#
#   > [!DONE] Concluídas
#   > - [X] tarefa concluída
#
# ── 3. Inserir no FINAL de Pendentes (comportamento de fila) ──────────────────
python3 - "$task" "$filename" <<'PYEOF'
import sys
import pathlib

task = sys.argv[1]
path = pathlib.Path(sys.argv[2])
lines = path.read_text().splitlines(keepends=True)

# 1. Acha o cabeçalho de Pendentes
header_idx = None
for i, line in enumerate(lines):
    if line.rstrip() == "> [!IMPORTANT] Pendentes":
        header_idx = i
        break

if header_idx is None:
    print(
        f"[ERRO] Seção '> [!IMPORTANT] Pendentes' não encontrada em {path}",
        file=sys.stderr
    )
    sys.exit(1)

# 2. Avança até o fim da seção: para na linha vazia ou no próximo bloco "> [!"
#    e mantém o índice de inserção após a última linha de tarefa encontrada
insert_idx = header_idx + 1          # fallback: seção vazia → logo após o header
for i in range(header_idx + 1, len(lines)):
    line = lines[i]
    if line.startswith("> - "):      # linha de tarefa existente
        insert_idx = i + 1           # empurra o ponto de inserção para depois dela
    elif line.strip() == "" or line.startswith("> [!"):
        break                        # fim da seção

# 3. Insere depois da última tarefa (ou logo após o header se a seção estiver vazia)
lines.insert(insert_idx, f"> - [] {task}\n")
path.write_text("".join(lines))
PYEOF

[ $? -ne 0 ] && {
  notify-send "new-task" "Falha ao escrever a tarefa no arquivo." \
    --urgency=critical --icon=dialog-error
  exit 1
}

# ── 4. Confirmação visual ─────────────────────────────────────────────────────
notify-send "✅ Tarefa adicionada" "${selected}  →  ${task}" --icon=checkbox

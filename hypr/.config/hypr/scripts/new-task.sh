#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ~/.config/hypr/scripts/new-task.sh
#
# Bind Hyprland:
#   bindd = SUPER, N, Nova tarefa, exec, ~/.config/hypr/scripts/new-task.sh
#
# Abre o modal nativo do AGS com foco, seleção de categoria e prioridade.
# ─────────────────────────────────────────────────────────────────────────────

ags request "new-task" 2>/dev/null || ags toggle "new-task-modal"

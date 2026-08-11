#!/bin/bash
CMD="$1"
FLOAT="$2"

ACTIVE_CLASS=$(hyprctl activewindow -j | jq -r '.class')
ACTIVE_PID=$(hyprctl activewindow -j | jq -r '.pid')

if [[ "$ACTIVE_CLASS" == "Alacritty" ]]; then
  # Procura sessão tmux cujo cliente é filho da janela ativa
  TMUX_TARGET=$(tmux list-clients -F '#{client_pid} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null | \
    while read line; do
      cpid=$(echo "$line" | cut -d' ' -f1)
      target=$(echo "$line" | cut -d' ' -f2)
      p=$cpid
      while [ "$p" -gt 1 ] 2>/dev/null; do
        [ "$p" = "$ACTIVE_PID" ] && echo "$target" && break
        p=$(awk '/^PPid/{print $2}' /proc/"$p"/status 2>/dev/null)
      done
    done | head -1)

  if [ -n "$TMUX_TARGET" ]; then
    tmux send-keys -t "$TMUX_TARGET" "$CMD" Enter
    exit 0
  fi

  # Fallback: digita na janela ativa via Wayland
  wtype -s 50 "$CMD"
  wtype -k Return
  exit 0
fi

# Sem terminal ativo — abre novo
if [ "$FLOAT" = "--float" ]; then
  alacritty --class floating -e bash -c "$CMD; exec bash" &
else
  alacritty -e bash -c "$CMD; exec bash" &
fi

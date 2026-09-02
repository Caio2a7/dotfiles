#!/usr/bin/env bash

CMD="$1"
FLOAT="$2"

[[ -z "$CMD" ]] && { echo "Uso: $0 \"<comando>\" [--float]" >&2; exit 1; }

TERMINAL_CLASSES=(alacritty kitty foot footclient wezterm org.wezfurlong.wezterm com.mitchellh.ghostty xterm urxvt st)
SHELLS=(bash zsh fish sh dash tcsh csh ksh)

in_list() {
  local needle="${1,,}" x
  shift
  for x in "$@"; do
    [[ "$needle" == "${x,,}" ]] && return 0
  done
  return 1
}

find_tmux_target() {
  local target_pid="$1"
  tmux list-clients -F '#{client_pid} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null |
    while read -r cpid target; do
      local p="$cpid"
      while [[ "$p" =~ ^[0-9]+$ ]] && [[ "$p" -gt 1 ]]; do
        if [[ "$p" == "$target_pid" ]]; then
          echo "$target"
          break
        fi
        p=$(awk '/^PPid:/{print $2}' "/proc/$p/status" 2>/dev/null)
      done
    done | head -n1
}

foreground_cmd_for_tty() {
  local tty="$1"
  ps -t "$tty" -o stat=,comm= 2>/dev/null | awk '$1 ~ /\+/ {print $2; exit}'
}

ACTIVE_JSON=$(hyprctl activewindow -j)
ACTIVE_CLASS=$(jq -r '.class // empty' <<<"$ACTIVE_JSON" 2>/dev/null)
ACTIVE_PID=$(jq -r '.pid // empty' <<<"$ACTIVE_JSON" 2>/dev/null)

TARGET_OK=0

if in_list "$ACTIVE_CLASS" "${TERMINAL_CLASSES[@]}"; then
  TMUX_TARGET=""
  [[ -n "$ACTIVE_PID" ]] && TMUX_TARGET=$(find_tmux_target "$ACTIVE_PID")

  if [[ -n "$TMUX_TARGET" ]]; then
    PANE_CMD=$(tmux display-message -p -t "$TMUX_TARGET" '#{pane_current_command}' 2>/dev/null)
    if in_list "$PANE_CMD" "${SHELLS[@]}"; then
      tmux send-keys -t "$TMUX_TARGET" "$CMD" Enter
      TARGET_OK=1
    fi
  else
    CHILD_PID=$(pgrep -P "$ACTIVE_PID" 2>/dev/null | head -n1)
    TTY=$(ps -o tty= -p "$CHILD_PID" 2>/dev/null | tr -d ' ')
    FG_CMD=$(foreground_cmd_for_tty "$TTY")
    if in_list "$FG_CMD" "${SHELLS[@]}"; then
      wtype -s 50 "$CMD"
      wtype -k Return
      TARGET_OK=1
    fi
  fi
fi

[[ "$TARGET_OK" -eq 1 ]] && exit 0

if [ "$FLOAT" = "--float" ]; then
  alacritty --class floating -e bash -c "$CMD; exec bash" &
else
  alacritty -e bash -c "$CMD; exec bash" &
fi

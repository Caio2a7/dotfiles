#!/usr/bin/env bash
# tracker-pick.sh
# Abre wofi (ou rofi) para escolher qual tracker iniciar/pausar via IPC.
#
# Bind no hyprland.conf:
#   bind = $mainMod, F9, exec, ~/.config/ags/scripts/tracker-pick.sh
#
# Requer: wofi (ou rofi — ajuste PICKER abaixo), ags no PATH

# ── Config ──────────────────────────────────────────────────────────
# Opções: "wofi" | "rofi" | "walker"
PICKER="walker"

# ── Trackers disponíveis (label exibido | chave interna) ────────────
ENTRIES=(
  "📖  Estudo|estudo"
  "🏢  Pathotech|pathotech"
  "💻  Dell|dell"
  "🖥️   STI|sti"
)

# ────────────────────────────────────────────────────────────────────
labels() {
  printf "%s\n" "${ENTRIES[@]}" | cut -d'|' -f1
}

key_for() {
  local chosen="$1"
  printf "%s\n" "${ENTRIES[@]}" | grep -F "${chosen}|" | cut -d'|' -f2
}

# ── Picker ──────────────────────────────────────────────────────────
case "$PICKER" in
  wofi)
    CHOSEN=$(labels | wofi --dmenu \
      --prompt "⏱ Tracker" \
      --style "$HOME/.config/wofi/style.css" \
      --no-actions \
      --insensitive \
      2>/dev/null)
    ;;
  rofi)
    CHOSEN=$(labels | rofi -dmenu \
      -p "⏱ Tracker" \
      -theme-str 'window {width: 280px;}' \
      2>/dev/null)
    ;;
  walker)
    CHOSEN=$(labels | walker --dmenu 2>/dev/null)
    ;;
  *)
    echo "PICKER inválido: $PICKER" >&2
    exit 1
    ;;
esac

[ -z "$CHOSEN" ] && exit 0

KEY=$(key_for "$CHOSEN")
if [ -z "$KEY" ]; then
  echo "Tracker não encontrado para: $CHOSEN" >&2
  exit 1
fi

# ── Envia requisição IPC para o AGS ─────────────────────────────────
# AGS v2 (Astal/Gnim) usa "ags request", não mais "ags message"
RESULT=$(ags request "{\"action\":\"toggle\",\"tracker\":\"$KEY\"}" 2>&1)
echo "[tracker-pick] $KEY → $RESULT"

# Notificação opcional (requer libnotify)
if command -v notify-send &>/dev/null; then
  if echo "$RESULT" | grep -q '"result":"started"'; then
    notify-send -t 2000 -i media-playback-start "Tracker iniciado" "$CHOSEN"
  else
    notify-send -t 2000 -i media-playback-stop  "Tracker pausado"  "$CHOSEN"
  fi
fi

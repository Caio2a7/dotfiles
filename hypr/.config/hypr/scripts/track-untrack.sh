#!/usr/bin/env bash
_TRACK_FILE="/tmp/.hab_track"
FILE="$HOME/vittae/registros.csv"
TODAY="$(date +%Y-%m-%d)"

_min_para_tempo() {
  local total=$1
  if (( total >= 60 )); then
    local h=$(( total / 60 )) m=$(( total % 60 ))
    (( m > 0 )) && echo "${h}h${m}m" || echo "${h}h"
  else
    echo "${total}m"
  fi
}

_tempo_para_min() {
  local t="$1" h=0 m=0
  [[ "$t" =~ ([0-9]+)h ]] && h="${BASH_REMATCH[1]}"
  [[ "$t" =~ ([0-9]+)m ]] && m="${BASH_REMATCH[1]}"
  echo $(( h * 60 + m ))
}

_get_line() {
  awk -F',' -v d="$TODAY" -v t="$1" \
    'NR>1 && $1==d && $2==t { print NR; exit }' "$FILE"
}

if [ -f "$_TRACK_FILE" ]; then
  # === UNTRACK ===
  ph="📚 Notas → $(sed -n '1p' "$_TRACK_FILE")"
  query=$(echo | walker --dmenu --placeholder "$ph")
  [ -n "$query" ] || exit 0

  topico="$(sed -n '1p' "$_TRACK_FILE")"
  start="$(sed -n '2p' "$_TRACK_FILE")"
  existing_min=$(( $(sed -n '3p' "$_TRACK_FILE") + 0 ))
  elapsed_min=$(( ($(date +%s) - start) / 60 ))
  total_min=$(( existing_min + elapsed_min ))
  tempo=$(_min_para_tempo "$total_min")
  line_num=$(_get_line "$topico")

  [[ -z "$line_num" ]] && { notify-send "📚 Track" "Erro: '$topico' não encontrado"; exit 1; }

  tmp="$(mktemp)"
  awk -F',' -v n="$line_num" -v tm="$tempo" -v nt="$query" \
    'NR==n { printf "%s,%s,%s,\"%s\"\n", $1, $2, tm, nt; next } { print }' \
    "$FILE" > "$tmp" && mv "$tmp" "$FILE"
  rm "$_TRACK_FILE"
  notify-send "📚 Track" "■ $topico — $tempo"

else
  # === TRACK ===
  [[ ! -f "$FILE" ]] && echo "data,topico,tempo,notas" > "$FILE"

  recent=$(awk -F',' 'NR>1 && $2!="" { print $2 }' "$FILE" | awk '!seen[$0]++' | head -6)
  query=$(printf '%s\n' "$recent" | walker --dmenu --placeholder "📚 Tópico")
  [ -n "$query" ] || exit 0

  topico="$query"
  line_num=$(_get_line "$topico")

  if [[ -n "$line_num" ]]; then
    existing_time=$(awk -F',' -v n="$line_num" \
      'NR==n { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3); print $3 }' "$FILE")
    existing_min=$(_tempo_para_min "$existing_time")
    notify-send "📚 Track" "▶ $topico (continuando — ${existing_time:-0m})"
  else
    tmp="$(mktemp)"
    { head -1 "$FILE"; echo "${TODAY},${topico},,"; tail -n +2 "$FILE"; } > "$tmp" && mv "$tmp" "$FILE"
    existing_min=0
    notify-send "📚 Track" "▶ $topico"
  fi

  printf '%s\n%s\n%s\n' "$topico" "$(date +%s)" "$existing_min" > "$_TRACK_FILE"
fi

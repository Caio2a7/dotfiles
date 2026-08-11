#!/usr/bin/env bash

_TRACK_FILE="/tmp/.hab_track"
FILE="$HOME/vittae/estudos.csv"
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
  ph="📚 Notas → $(sed -n '1p' "$_TRACK_FILE")"
else
  ph="📚 Tópico"
fi

query=$(echo | walker --dmenu --placeholder "$ph")
[ -n "$query" ] || exit 0

if [ -f "$_TRACK_FILE" ]; then
  # === UNTRACK ===
  topico="$(sed -n '1p' "$_TRACK_FILE")"
  start="$(sed -n '2p' "$_TRACK_FILE")"
  existing_min="$(sed -n '3p' "$_TRACK_FILE")"
  existing_min=$(( ${existing_min:-0} + 0 ))

  elapsed_min=$(( ($(date +%s) - start) / 60 ))
  total_min=$(( existing_min + elapsed_min ))
  tempo=$(_min_para_tempo "$total_min")

  line_num=$(_get_line "$topico")
  if [[ -z "$line_num" ]]; then
    notify-send "📚 Tópico" "Erro: '$topico' não encontrado no CSV"
    exit 1
  fi

  tmp="$(mktemp)"
  awk -F',' -v n="$line_num" -v tm="$tempo" -v nt="$query" \
    'NR==n { printf "%s,%s,%s,\"%s\"\n", $1, $2, tm, nt; next } { print }' \
    "$FILE" > "$tmp" && mv "$tmp" "$FILE"

  rm "$_TRACK_FILE"
  notify-send "📚 Tópico" "■ $topico — $tempo"

else
  # === TRACK ===
  topico="$query"
  [[ ! -f "$FILE" ]] && echo "data,topico,tempo,notas" > "$FILE"

  line_num=$(_get_line "$topico")

  if [[ -n "$line_num" ]]; then
    # lê e trimma o campo tempo pra garantir
    existing_time=$(awk -F',' -v n="$line_num" 'NR==n { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3); print $3 }' "$FILE")
    existing_min=$(_tempo_para_min "$existing_time")
    notify-send "📚 Tópico" "▶ $topico (continuando — ${existing_time:-0m})"
  else
    echo "${TODAY},${topico},," >> "$FILE"
    existing_min=0
    notify-send "📚 Tópico" "▶ $topico"
  fi

  printf '%s\n%s\n%s\n' "$topico" "$(date +%s)" "$existing_min" > "$_TRACK_FILE"
fi

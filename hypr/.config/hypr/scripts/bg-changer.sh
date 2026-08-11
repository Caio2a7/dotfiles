#!/bin/bash
DIR="$HOME/.config/omarchy/current/theme/backgrounds"
INTERVAL=300
while true; do
  PICS=($(find ${DIR} -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \)))
  RANDOMPIC=${PICS[ $RANDOM % ${#PICS[@]} ]}
  if [[ -n "$RANDOMPIC" ]]; then
    swww img "$RANDOMPIC" --transition-type grow --transition-pos 0.5,0.5 --transition-step 90
    sleep 0.5
    wallust run "$RANDOMPIC"
    # Aplica as cores em todos os terminais abertos
    # for tty in /dev/pts/*; do
      # cat ~/.cache/wallust/sequences > "$tty" 2>/dev/null
    # done
  fi
  sleep $INTERVAL
done

#!/bin/bash
arquivo=$1
if hyprctl clients -j | grep -q '"class": "vittae"'; then
  hyprctl dispatch togglespecialworkspace vittae
else
  hyprctl dispatch exec "[workspace special:vittae] alacritty --class vittae -e nvim ~/vittae/$arquivo"
  sleep 0.3
  W=$(hyprctl monitors -j | jq '.[0].width * 8 / 10')
  H=$(hyprctl monitors -j | jq '.[0].height * 7 / 10')
  hyprctl dispatch resizewindowpixel exact ${W} ${H}, class:vittae
  hyprctl dispatch centerwindow class:vittae
fi

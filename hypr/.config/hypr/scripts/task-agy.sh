#!/bin/bash
query=$(echo | walker --dmenu --placeholder "📝 Nova tarefa...")
[ -z "$query" ] && exit 0
(
  flock -x 200
  result=$(cd ~/.config/to-do-nvim && agy --dangerously-skip-permissions -p "$query" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g')
  notify-send "✅ Task" "$result"
) 200>/tmp/task-agy.lock

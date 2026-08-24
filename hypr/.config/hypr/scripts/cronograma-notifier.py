#!/usr/bin/env python3
"""
cronograma-notifier.py
Monitora ~/vittae/cronograma.csv e emite notificações com som leve e emojis
apenas na transição de blocos de atividades (sem repetições redundantes).
"""

import os
import sys
import time
import csv
import subprocess
from datetime import datetime
from pathlib import Path

HOME = Path.home()
CSV_PATH = HOME / "vittae" / "cronograma.csv"

ACTIVITY_MAP = {
    "faculd": {"emoji": "🎓", "desc": "Horário de Faculdade"},
    "estud": {"emoji": "📚", "desc": "Foco nos Estudos"},
    "trabalh": {"emoji": "💼", "desc": "Horário de Trabalho"},
    "ingl": {"emoji": "💬", "desc": "Prática de Inglês"},
    "dorm": {"emoji": "💤", "desc": "Hora de Dormir / Descanso"},
    "xuxi": {"emoji": "💖", "desc": "Momento com Xuxis"},
    "bus": {"emoji": "🚌", "desc": "Deslocamento / Busão"},
    "leitur": {"emoji": "📖", "desc": "Hora da Leitura"},
    "livre": {"emoji": "🎮", "desc": "Tempo Livre"},
    "acad": {"emoji": "🏋️", "desc": "Treino / Academia"},
    "exerc": {"emoji": "🏋️", "desc": "Treino / Exercício"},
    "medita": {"emoji": "🧘", "desc": "Momento de Meditação"},
    "almo": {"emoji": "🍱", "desc": "Horário de Almoço"},
    "janta": {"emoji": "🍲", "desc": "Horário de Jantar"},
}

def get_activity_info(act_name: str):
    norm = act_name.lower().strip()
    for key, val in ACTIVITY_MAP.items():
        if key in norm:
            return val
    return {"emoji": "📌", "desc": act_name}

def play_sound():
    try:
        subprocess.run(["canberra-gtk-play", "-i", "message"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        try:
            subprocess.run(["paplay", "/usr/share/sounds/freedesktop/stereo/message.oga"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

def send_notification(act_name: str, time_str: str):
    info = get_activity_info(act_name)
    title = f"{info['emoji']} {act_name}"
    body = f"{info['desc']} • {time_str}"
    
    try:
        subprocess.run([
            "notify-send",
            "-a", "Cronograma",
            "-i", "appointment-soon",
            "-u", "normal",
            title,
            body
        ], check=False)
        play_sound()
    except Exception as e:
        print(f"Erro ao enviar notificação: {e}", file=sys.stderr)

def get_current_slot():
    if not CSV_PATH.exists():
        return None, None

    now = datetime.now()
    # 0 = Monday, ..., 6 = Sunday
    day_idx = now.weekday()
    current_hour = now.hour

    try:
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if len(row) < 8:
                    continue
                time_str = row[0].strip()
                activities = [c.strip() for c in row[1:8]]

                # Parse hour range (ex: "05:00 - 06:00" ou "23:00 - 00:00")
                parts = time_str.split("-")
                if len(parts) == 2:
                    try:
                        start_h = int(parts[0].split(":")[0].strip())
                        end_h = int(parts[1].split(":")[0].strip())
                    except ValueError:
                        continue

                    is_match = False
                    if start_h == 23 and end_h == 0:
                        if current_hour == 23:
                            is_match = True
                    elif start_h <= current_hour < end_h:
                        is_match = True

                    if is_match:
                        act = activities[day_idx] if day_idx < len(activities) else ""
                        return act, time_str
    except Exception as e:
        print(f"Erro ao ler CSV: {e}", file=sys.stderr)

    return None, None

def main():
    last_act = None
    print("Cronograma Notifier iniciado...")
    while True:
        act, time_str = get_current_slot()
        if act and act != last_act:
            last_act = act
            send_notification(act, time_str)
        time.sleep(10)

if __name__ == "__main__":
    main()

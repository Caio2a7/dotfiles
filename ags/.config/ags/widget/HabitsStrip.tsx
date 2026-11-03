import { Gtk } from "ags/gtk4"
import { openHabitsModal } from "./HabitsModal"
import { HabitRow, HabitsState, rowsOf, subscribeHabits } from "./habitsStore"

const HEX = /^#[0-9a-fA-F]{6}$/
const ESTADO_TXT: Record<string, string> = {
  feito: "feito",
  parcial: "parcial",
  falhou: "falhou",
  pulado: "pulado",
  pendente: "pendente",
  sem_registro: "pendente",
  fora: "-",
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function cardOf(r: HabitRow): Gtk.Widget {
  const cor = r.hab.cor && HEX.test(r.hab.cor) ? r.hab.cor : "#94a3b8"
  const done = r.dia.estado === "feito"
  const score = `${Math.round(r.resumo.score * 100)}%`
  const name = new Gtk.Label({
    useMarkup: true,
    xalign: 0,
    hexpand: true,
    label: `<span foreground="${cor}">●</span>  <span foreground="#ffffff" size="10500">${esc(r.hab.nome)}</span>`,
  })
  const state = new Gtk.Label({
    useMarkup: true,
    xalign: 0,
    hexpand: true,
    label: `<span size="9500" foreground="${done ? "#4ade80" : "#94a3b8"}">${ESTADO_TXT[r.dia.estado] ?? r.dia.estado}</span>`,
  })
  const pct = new Gtk.Label({ label: score, xalign: 1, cssClasses: ["habit-score"] })
  const top = new Gtk.Box({ spacing: 6 })
  top.append(name)
  top.append(pct)
  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    hexpand: true,
    vexpand: true,
    cssClasses: done ? ["habit-mini-card", "habit-done"] : ["habit-mini-card"],
  })
  card.append(top)
  card.append(state)
  return card
}

function fill(box: Gtk.Box, s: HabitsState): void {
  let c = box.get_first_child()
  while (c) {
    const next = c.get_next_sibling()
    box.remove(c)
    c = next
  }
  if (s.erro) box.append(new Gtk.Label({ label: `Hábitos: ${s.erro}`, hexpand: true, cssClasses: ["habits-status"] }))
  rowsOf(s).forEach((r) => box.append(cardOf(r)))
}

// Faixa compacta: score % e estado de hoje por hábito (fonte: habitsStore)
export function HabitsStreakPanel(panelHeight: number): Gtk.Widget {
  const row = new Gtk.Box({ spacing: 8, homogeneous: true, hexpand: true, vexpand: true })
  const panel = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    hexpand: true,
    vexpand: false,
    heightRequest: panelHeight,
    cssClasses: ["dash-inner-panel", "habits-top-panel"],
  })
  panel.append(row)
  panel.set_overflow(Gtk.Overflow.HIDDEN)
  const click = new Gtk.GestureClick()
  click.set_button(1)
  click.connect("pressed", () => openHabitsModal())
  panel.add_controller(click)
  const unsubscribe = subscribeHabits((s) => fill(row, s))
  panel.connect("destroy", unsubscribe)
  return panel
}

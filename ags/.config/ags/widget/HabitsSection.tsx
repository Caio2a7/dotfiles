import { Gtk } from "ags/gtk4"
import { RingContext, drawRing } from "./StudySection"
import { HabitsState, isPendente, rowsOf, subscribeHabits, temAlerta } from "./habitsStore"
import { openHabitsModal } from "./HabitsModal"

const RING_SIZE = 30
const RING_RGB: [number, number, number] = [0.204, 0.827, 0.6]

function buildChip() {
  const ring = new Gtk.DrawingArea({ contentWidth: RING_SIZE, contentHeight: RING_SIZE, halign: Gtk.Align.CENTER })
  const label = new Gtk.Label({ cssClasses: ["habits-count"], halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER })
  const dot = new Gtk.Box({ cssClasses: ["habits-alert-dot"], halign: Gtk.Align.END, valign: Gtk.Align.START, visible: false })
  const overlay = new Gtk.Overlay({ child: ring, halign: Gtk.Align.CENTER })
  overlay.add_overlay(label)
  overlay.add_overlay(dot)
  overlay.set_measure_overlay(label, false)
  overlay.set_measure_overlay(dot, false)
  const box = new Gtk.Box({
    cssClasses: ["apple-status-capsule", "habits-capsule"],
    halign: Gtk.Align.CENTER,
  })
  box.append(overlay)
  box.set_cursor_from_name("pointer")
  return { box, ring, label, dot }
}

// Chip da dock: x/N feitos hoje com anel de progresso, ponto âmbar de alerta, clique abre o modal
export function HabitsSection() {
  const { box, ring, label, dot } = buildChip()
  let frac = 0

  ring.set_draw_func((_a, cr, w, h) => drawRing(cr as unknown as RingContext, w, h, frac, RING_RGB))

  const apply = (s: HabitsState) => {
    const rows = rowsOf(s).filter((r) => r.dia.estado !== "fora")
    const feitos = rows.filter((r) => r.dia.estado === "feito").length
    const pend = rows.filter(isPendente)
    frac = rows.length ? feitos / rows.length : 0
    label.label = `${feitos}/${rows.length}`
    dot.visible = temAlerta(s, rows)
    box.tooltipText = s.erro
      ? `Hábitos: ${s.erro}`
      : pend.length
        ? `Pendentes:\n${pend.map((r) => r.hab.nome).join("\n")}`
        : "Hábitos de hoje concluídos"
    ring.queue_draw()
  }

  const click = new Gtk.GestureClick()
  click.set_button(1)
  click.connect("pressed", () => openHabitsModal())
  box.add_controller(click)

  const unsubscribe = subscribeHabits(apply)
  box.connect("destroy", unsubscribe)
  return box
}

import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { buildHabitRow } from "./HabitRowView"
import { HabitsState, rowsOf, subscribeHabits } from "./habitsStore"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
const V = Gtk.Orientation.VERTICAL

let modal: Astal.Window | null = null

// targetDate é aceito por compatibilidade com chamadores antigos; o check-in é sempre de hoje
export function openHabitsModal(_targetDate?: string): void {
  modal?.set_visible(true)
}

export function toggleHabitsModal(): void {
  if (modal) modal.set_visible(!modal.visible)
}

export function closeHabitsModal(): void {
  modal?.set_visible(false)
}

function clear(box: Gtk.Box): void {
  let c = box.get_first_child()
  while (c) {
    const next = c.get_next_sibling()
    box.remove(c)
    c = next
  }
}

export function HabitsModal(monitor = 0): Astal.Window {
  const list = new Gtk.Box({ orientation: V, spacing: 2 })
  const status = new Gtk.Label({ label: "", xalign: 0, hexpand: true, cssClasses: ["habits-status"] })
  const title = new Gtk.Label({ label: "Hábitos", xalign: 0, cssClasses: ["habits-title"] })
  const sub = new Gtk.Label({ label: "", xalign: 0, hexpand: true, cssClasses: ["habits-sub"] })
  let last: HabitsState | null = null

  const report = (fn: () => void) => {
    try {
      fn()
      status.label = ""
    } catch (err) {
      status.label = err instanceof Error ? err.message : String(err)
      console.error("Hábitos:", err)
    }
  }

  const render = (s: HabitsState) => {
    last = s
    clear(list)
    sub.label = s.erro ?? s.hoje
    rowsOf(s).forEach((r) => list.append(buildHabitRow(s, r, report)))
  }

  const header = new Gtk.Box({ spacing: 8, cssClasses: ["habits-header"] })
  header.append(title)
  header.append(sub)
  const footer = new Gtk.Box({ spacing: 8, cssClasses: ["habits-footer"] })
  footer.append(status)
  footer.append(new Gtk.Label({ label: "Esc fecha", cssClasses: ["habits-sub"] }))

  const card = new Gtk.Box({
    orientation: V,
    spacing: 8,
    widthRequest: 460,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ["habits-card"],
  })
  card.append(header)
  card.append(list)
  card.append(footer)

  const scrim = new Gtk.Box({ hexpand: true, vexpand: true, cssClasses: ["habits-scrim"] })
  scrim.append(card)
  const outside = new Gtk.GestureClick()
  outside.connect("pressed", (_g, _n, x, y) => {
    // card centralizado no scrim
    const px = (scrim.get_width() - card.get_width()) / 2
    const py = (scrim.get_height() - card.get_height()) / 2
    const inside = x >= px && x <= px + card.get_width() && y >= py && y <= py + card.get_height()
    if (!inside) closeHabitsModal()
  })
  scrim.add_controller(outside)

  const win = (
    <window
      name="habits-modal"
      class="HabitsModal"
      monitor={monitor}
      application={app}
      visible={false}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
    >
      {scrim}
    </window>
  ) as Astal.Window

  const keys = new Gtk.EventControllerKey()
  keys.connect("key-pressed", (_c, keyval) => {
    if (keyval !== Gdk.KEY_Escape) return false
    closeHabitsModal()
    return true
  })
  win.add_controller(keys)
  subscribeHabits(render)
  win.connect("notify::visible", () => {
    if (win.visible && last) render(last)
  })
  modal = win
  return win
}

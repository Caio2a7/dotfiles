import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
const H = Gtk.Orientation.HORIZONTAL
const V = Gtk.Orientation.VERTICAL

const VITTAE_DIR = `${GLib.get_home_dir()}/vittae`
const HABIT_FILE = `${VITTAE_DIR}/habitos.csv`

export const HABIT_DEFS = [
  { key: "meditacao", name: "Meditação", icon: "󰤄" },
  { key: "exercicio", name: "Exercício", icon: "󰓥" },
  { key: "leitura", name: "Leitura", icon: "" },
  { key: "ingles", name: "Inglês", icon: "󰗊" },
  { key: "estudo", name: "Estudo", icon: "󰑴" },
  { key: "vicio", name: "Sem Vício", icon: "" },
]

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

function readFile(path: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok) return ""
    return new TextDecoder().decode(bytes)
  } catch {
    return ""
  }
}

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.trim().split("-").map(Number)
  if (parts.length !== 3 || isNaN(parts[0])) return dateStr
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return `${DAY_NAMES[dt.getDay()]}, ${String(parts[2]).padStart(2, "0")} de ${MONTH_NAMES[dt.getMonth()]}`
}

export function readHabitsForDate(targetDate: string): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  HABIT_DEFS.forEach((h) => {
    result[h.key] = false
  })

  try {
    const raw = readFile(HABIT_FILE)
    if (!raw) return result
    const lines = raw.split("\n")
    if (lines.length < 2) return result

    const header = lines[0].split(",").map((s) => s.trim().toLowerCase())
    const colIndices: Record<string, number> = {}
    HABIT_DEFS.forEach((h) => {
      const idx = header.indexOf(h.key)
      if (idx !== -1) colIndices[h.key] = idx
    })

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(",").map((s) => s.trim())
      if (parts[0] === targetDate) {
        HABIT_DEFS.forEach((h) => {
          const cIdx = colIndices[h.key]
          const val = cIdx !== undefined && parts[cIdx] ? parts[cIdx] : ""
          result[h.key] = val.includes("✅")
        })
        break
      }
    }
  } catch (e) {
    console.error("Erro ao ler status de habitos para data:", targetDate, e)
  }

  return result
}

export function saveHabitsForDate(targetDate: string, states: Record<string, boolean>): boolean {
  try {
    const raw = readFile(HABIT_FILE)
    if (!raw) return false
    const lines = raw.split("\n")
    if (lines.length < 1) return false

    const header = lines[0].split(",").map((s) => s.trim().toLowerCase())
    const colIndices: Record<string, number> = {}
    HABIT_DEFS.forEach((h) => {
      const idx = header.indexOf(h.key)
      if (idx !== -1) colIndices[h.key] = idx
    })

    let found = false
    const newLines = lines.map((line, idx) => {
      if (idx === 0 || !line.trim()) return line
      const parts = line.split(",").map((s) => s.trim())
      if (parts[0] === targetDate) {
        found = true
        HABIT_DEFS.forEach((h) => {
          const cIdx = colIndices[h.key]
          if (cIdx !== undefined) {
            parts[cIdx] = states[h.key] ? "✅" : "❎"
          }
        })
        return parts.join(",")
      }
      return line
    })

    if (!found) {
      const parts = new Array(header.length).fill("")
      parts[0] = targetDate
      HABIT_DEFS.forEach((h) => {
        const cIdx = colIndices[h.key]
        if (cIdx !== undefined) {
          parts[cIdx] = states[h.key] ? "✅" : "❎"
        }
      })
      newLines.splice(1, 0, parts.join(","))
    }

    const content = newLines.join("\n")
    GLib.file_set_contents(HABIT_FILE, content)
    return true
  } catch (e) {
    console.error("Erro ao salvar habitos para data:", targetDate, e)
    return false
  }
}

export function ensureTodayHabitLine(): { created: boolean; previousUnfilledDate: string | null } {
  try {
    const raw = readFile(HABIT_FILE)
    const todayStr = getTodayString()

    if (!raw) {
      const defaultContent = "data,meditacao,exercicio,leitura,ingles,estudo,vicio,notas\n" + `${todayStr},,,,,,,,\n`
      GLib.file_set_contents(HABIT_FILE, defaultContent)
      return { created: true, previousUnfilledDate: null }
    }

    const lines = raw.split("\n")
    let hasToday = false

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      if (line.startsWith(`${todayStr},`)) {
        hasToday = true
        break
      }
    }

    let created = false
    if (!hasToday) {
      const header = lines[0].split(",").map((s) => s.trim().toLowerCase())
      const parts = new Array(header.length).fill("")
      parts[0] = todayStr
      lines.splice(1, 0, parts.join(","))
      GLib.file_set_contents(HABIT_FILE, lines.join("\n"))
      created = true
    }

    const header = lines[0].split(",").map((s) => s.trim().toLowerCase())
    const colIndices: Record<string, number> = {}
    HABIT_DEFS.forEach((h) => {
      const idx = header.indexOf(h.key)
      if (idx !== -1) colIndices[h.key] = idx
    })

    // Verifica se o dia anterior tem ao menos uma célula sem resposta (sem ✅ e sem ❎)
    let previousUnfilledDate: string | null = null
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(",").map((s) => s.trim())
      const dateStr = parts[0]
      if (dateStr === todayStr) continue

      let hasUnanswered = false
      for (const h of HABIT_DEFS) {
        const cIdx = colIndices[h.key]
        const val = cIdx !== undefined && parts[cIdx] ? parts[cIdx].trim() : ""
        if (!val.includes("✅") && !val.includes("❎")) {
          hasUnanswered = true
          break
        }
      }

      if (hasUnanswered) {
        previousUnfilledDate = dateStr
      }
      break
    }

    return { created, previousUnfilledDate }
  } catch (e) {
    console.error("Erro em ensureTodayHabitLine:", e)
    return { created: false, previousUnfilledDate: null }
  }
}

let modalWindowInstance: Astal.Window | null = null
let refreshModalView: ((targetDate: string) => void) | null = null

export function openHabitsModal(targetDate?: string) {
  const dateStr = !targetDate || targetDate === "today" ? getTodayString() : targetDate
  if (refreshModalView) {
    refreshModalView(dateStr)
  }
  if (modalWindowInstance) {
    modalWindowInstance.visible = true
  }
}

export function closeHabitsModal() {
  if (modalWindowInstance) {
    modalWindowInstance.visible = false
  }
}

export function checkAndPromptUnfilledHabits() {
  const check = ensureTodayHabitLine()
  if (check.previousUnfilledDate) {
    openHabitsModal(check.previousUnfilledDate)
  }
}

export function HabitsModal(monitor = 0): Astal.Window {
  let currentDate = getTodayString()
  let currentStates: Record<string, boolean> = {}

  const titleLabel = (<label class="habits-title-text" halign={Gtk.Align.START} label="Registro de Hábitos" />) as Gtk.Label
  const subtitleLabel = (<label class="habits-subtitle-text" halign={Gtk.Align.START} label="" />) as Gtk.Label
  const badgeLabel = (<label label="Hoje" />) as Gtk.Label

  const badgeBox = (
    <box class="habit-badge badge-today" halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
      {badgeLabel}
    </box>
  ) as Gtk.Widget

  const rowsBox = new Gtk.Box({
    orientation: V,
    spacing: 6,
    hexpand: true,
  })

  function renderRows() {
    let child = rowsBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      rowsBox.remove(child)
      child = next
    }

    HABIT_DEFS.forEach((h) => {
      const isDone = currentStates[h.key] || false

      const rowBtn = (
        <button
          class={`habit-modal-row ${isDone ? "done" : "pending"}`}
          hexpand={true}
          onClicked={() => {
            currentStates[h.key] = !currentStates[h.key]
            saveHabitsForDate(currentDate, currentStates)
            renderRows()
          }}
        >
          <box orientation={H} spacing={8} hexpand={true} valign={Gtk.Align.CENTER}>
            <label class="habit-modal-icon" label={h.icon} />
            <label class="habit-modal-name" label={h.name} hexpand={true} halign={Gtk.Align.START} />
            <box class="habit-status-badge" orientation={H} spacing={6} valign={Gtk.Align.CENTER}>
              <label class={`habit-status-icon ${isDone ? "done" : "pending"}`} label={isDone ? "󰄬" : "󰅖"} />
              <label class={`habit-status-label ${isDone ? "done" : "pending"}`} label={isDone ? "Feito" : "Não feito"} />
            </box>
          </box>
        </button>
      ) as Gtk.Widget

      rowsBox.append(rowBtn)
    })
  }

  function updateView(dateStr: string) {
    currentDate = dateStr
    const todayStr = getTodayString()
    const isToday = dateStr === todayStr

    if (isToday) {
      titleLabel.label = "Hábitos de Hoje"
      badgeLabel.label = "Hoje"
      badgeBox.set_css_classes(["habit-badge", "badge-today"])
    } else {
      titleLabel.label = "Registro de Hábitos"
      badgeLabel.label = "Ontem Pendente"
      badgeBox.set_css_classes(["habit-badge", "badge-pending"])
    }

    subtitleLabel.label = formatDisplayDate(dateStr)
    currentStates = readHabitsForDate(dateStr)
    renderRows()
  }

  refreshModalView = updateView
  updateView(currentDate)

  const card = (
    <box
      class="habits-dialog"
      orientation={V}
      spacing={0}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    >
      <box class="habits-header" orientation={H} hexpand={true} valign={Gtk.Align.CENTER}>
        <label class="habits-title-icon" label="󰄬" />
        <box orientation={V} hexpand={true}>
          {titleLabel}
          {subtitleLabel}
        </box>
        {badgeBox}
      </box>

      <box class="habit-modal-rows" orientation={V} hexpand={true}>
        {rowsBox}
      </box>

      <box class="habits-footer" orientation={H} spacing={10} hexpand={true} valign={Gtk.Align.CENTER}>
        <button
          class="habits-btn-close"
          hexpand={true}
          onClicked={() => closeHabitsModal()}
        >
          <label label="Fechar (Esc)" />
        </button>
        <button
          class="habits-btn-save"
          hexpand={true}
          onClicked={() => {
            saveHabitsForDate(currentDate, currentStates)
            closeHabitsModal()
          }}
        >
          <label label="Salvar e Sair" />
        </button>
      </box>
    </box>
  ) as Gtk.Widget

  const scrim = (
    <box
      class="habits-scrim"
      hexpand={true}
      vexpand={true}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
    >
      {card}
    </box>
  ) as Gtk.Widget

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

  const keyController = new Gtk.EventControllerKey()
  keyController.connect("key-pressed", (_c, keyval) => {
    if (keyval === Gdk.KEY_Escape || keyval === 65307) {
      closeHabitsModal()
      return true
    }
    return false
  })
  win.add_controller(keyController)

  modalWindowInstance = win
  return win
}

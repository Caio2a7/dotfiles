import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import Pango from "gi://Pango"

const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
const H = Gtk.Orientation.HORIZONTAL
const V = Gtk.Orientation.VERTICAL

const TODO_DIR = `${GLib.get_home_dir()}/vittae/tarefas`
const TERMINAL = "alacritty"

const ORDERED_FILES = [
  { file: "autodidata.md", label: "Autodidata" },
  { file: "faculdade.md", label: "Faculdade" },
  { file: "pathotech.md", label: "Pathotech" },
  { file: "dell.md", label: "Dell" },
  { file: "sti.md", label: "Sti" },
  { file: "vida.md", label: "Vida" },
]

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

interface Task { text: string; done: boolean }
interface TodoData { urgent: Task[]; pending: Task[] }

function parseFromString(raw: string): TodoData {
  const lines = raw.split("\n")
  let section: "urgent" | "pending" | "skip" = "skip"
  const urgent: Task[] = []
  const pending: Task[] = []

  for (const line of lines) {
    if (line.includes("[!WARNING]"))   { section = "urgent";  continue }
    if (line.includes("[!IMPORTANT]")) { section = "pending"; continue }
    if (line.includes("[!DONE]") || line.includes("[!TIP]") || line.includes("[!CAUTION]")) {
      section = "skip"; continue
    }
    if (section === "skip") continue

    const m = line.match(/(?:>\s*)?-\s*\[([xX ]?)\]\s*(.+)/)
    if (!m) continue

    const task = { done: m[1].toLowerCase() === "x", text: m[2].trim() }
    if (section === "urgent") urgent.push(task)
    else                      pending.push(task)
  }

  return { urgent, pending }
}

function buildMarkup(raw: string): string {
  try {
    const { urgent, pending } = parseFromString(raw)
    const lines: string[] = []

    if (urgent.length > 0) {
      lines.push(`<span foreground="#ff6b6b" weight="bold">⚠ Urgente</span>`)
      urgent.forEach(t =>
        lines.push(
          `<span foreground="${t.done ? "#555555" : "#ffb3b3"}">  ${t.done ? "✓" : "●"} ${esc(t.text)}</span>`
        )
      )
    }

    if (pending.length > 0) {
      if (lines.length > 0) lines.push("")
      lines.push(`<span foreground="#ffd93d" weight="bold">● Pendentes</span>`)
      pending.forEach(t =>
        lines.push(
          `<span foreground="${t.done ? "#555555" : "#dcdcdc"}">  ${t.done ? "✓" : "○"} ${esc(t.text)}</span>`
        )
      )
    }

    if (lines.length === 0)
      lines.push(`<span foreground="#4ade80">✓ Tudo em dia</span>`)

    return lines.join("\n")
  } catch {
    return `<span foreground="#4ade80">✓ Tudo em dia</span>`
  }
}

function readFile(filename: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(`${TODO_DIR}/${filename}`)
    if (!ok) return ""
    return new TextDecoder().decode(bytes)
  } catch {
    return ""
  }
}

function openInNvim(filename: string): void {
  const filePath = `${TODO_DIR}/${filename}`
  try {
    Gio.Subprocess.new(
      [
        "hyprctl", "dispatch", "exec",
        `[float;center] ${TERMINAL} --class todo-nvim-editor -e nvim "${filePath}"`,
      ],
      Gio.SubprocessFlags.NONE,
    )
  } catch (e) {
    console.error("Erro ao abrir nvim:", e)
  }
}

function TodoCard(filename: string, label: string): Gtk.Widget {
  const bodyLabel = new Gtk.Label({
    halign: Gtk.Align.START,
    valign: Gtk.Align.START,
    hexpand: true,
    wrap: true,
    wrapMode: Pango.WrapMode.WORD_CHAR,
    maxWidthChars: 22,
    useMarkup: true,
    cssClasses: ["todo-card-body"],
  })

  bodyLabel.set_label(buildMarkup(readFile(filename)))

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    bodyLabel.set_label(buildMarkup(readFile(filename)))
    return GLib.SOURCE_CONTINUE
  })

  const card = (
    <box class="todo-card" orientation={V} spacing={10} hexpand={true}>
      <label
        class="todo-card-title"
        label={label}
        halign={Gtk.Align.START}
        tooltipText="Duplo clique para editar"
      />
      <box class="todo-divider" heightRequest={1} />
      {bodyLabel}
    </box>
  ) as Gtk.Widget

  const gesture = new Gtk.GestureClick()
  gesture.set_button(1)
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    if (nPress === 2) openInNvim(filename)
  })
  card.add_controller(gesture)

  card.valign = Gtk.Align.START
  return card
}

export function TodoCards(monitor = 0): Astal.Window {
  return (
    <window
      name="todo-cards"
      class="TodoCards"
      monitor={monitor}
      application={app}
      visible={false}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | LEFT | RIGHT}
      layer={Astal.Layer.BOTTOM}
      marginTop={12}
      marginLeft={12}
      marginRight={12}
    >
      <box orientation={H} spacing={8} hexpand={true} homogeneous={true} halign={Gtk.Align.FILL}>
        {ORDERED_FILES.map(({ file, label }) => TodoCard(file, label))}
      </box>
    </window>
  ) as Astal.Window
}

import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

const { TOP, LEFT } = Astal.WindowAnchor
const H = Gtk.Orientation.HORIZONTAL
const V = Gtk.Orientation.VERTICAL

const TODO_DIR = `${GLib.get_home_dir()}/.config/to-do-nvim`

// ── Terminal e flag de app-id por terminal:
//   foot      → "--app-id"
//   kitty     → "--class"
//   alacritty → "--class"
//   wezterm   → "--class"
//
const TERMINAL = "alacritty"
const APP_ID_FLAG = "--app-id"
const APP_ID = "todo-nvim-editor"

// ── Markup escaping manual
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── Tipos
interface Task { text: string; done: boolean }
interface TodoData { urgent: Task[]; pending: Task[] }

// ── Descobre arquivos *.md no diretório, ignora GEMINI.md
function getMdFiles(): { file: string; label: string }[] {
  const results: { file: string; label: string }[] = []
  try {
    const dir = Gio.File.new_for_path(TODO_DIR)
    const enumerator = dir.enumerate_children(
      "standard::name",
      Gio.FileQueryInfoFlags.NONE,
      null
    )
    let info: Gio.FileInfo | null
    while ((info = enumerator.next_file(null)) !== null) {
      const name = info.get_name()
      if (!name.endsWith(".md")) continue
      if (name.toLowerCase() === "gemini.md") continue
      const base = name.replace(/\.md$/, "")
      const label = base.charAt(0).toUpperCase() + base.slice(1)
      results.push({ file: name, label })
    }
  } catch (e) {
    console.error(`Erro ao listar ${TODO_DIR}:`, e)
  }
  return results.sort((a, b) => a.file.localeCompare(b.file))
}

// ── Parser do formato markdown do to-do-nvim
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

    const m = line.match(/(?:>\s*)?-\s*\[([xX ])\]\s*(.+)/)
    if (!m) continue

    const task = { done: m[1].toLowerCase() === "x", text: m[2].trim() }
    if (section === "urgent") urgent.push(task)
    else                      pending.push(task)
  }

  return { urgent, pending }
}

// ── Gera o Pango markup para o label
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

// ── Lê arquivo de forma síncrona
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
  console.log("Abrindo no nvim:", filePath)
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

// ── Card individual por arquivo
function TodoCard(filename: string, label: string): Gtk.Widget {
  const bodyLabel = new Gtk.Label({
    halign: Gtk.Align.START,
    valign: Gtk.Align.START,
    wrap: true,
    maxWidthChars: 30,
    useMarkup: true,
    cssClasses: ["todo-card-body"],
  })

  // Carga inicial
  bodyLabel.set_label(buildMarkup(readFile(filename)))

  // Polling a cada 2s
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    bodyLabel.set_label(buildMarkup(readFile(filename)))
    return GLib.SOURCE_CONTINUE
  })

  const card = (
    <box class="todo-card" orientation={V} spacing={10}>
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

  // ── GestureClick: detecta duplo clique (nPress === 2)
  const gesture = new Gtk.GestureClick()
  gesture.set_button(1) // botão esquerdo
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    console.log(`Click em "${label}": nPress=${nPress}`)
    if (nPress === 2) openInNvim(filename)
  })
  card.add_controller(gesture)

  card.valign = Gtk.Align.START
  return card
}

// ── Janela principal
export function TodoCards(monitor = 0): Astal.Window {
  const files = getMdFiles()

  return (
    <window
      name="todo-cards"
      class="TodoCards"
      monitor={monitor}
      application={app}
      visible={false}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | LEFT}
      layer={Astal.Layer.BOTTOM}
      marginTop={12}
      marginLeft={12}
    >
      <box orientation={H} spacing={12}>
        {files.map(({ file, label }) => TodoCard(file, label))}
      </box>
    </window>
  ) as Astal.Window
}

import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import Pango from "gi://Pango"
import cairo from "gi://cairo"

const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor
const H = Gtk.Orientation.HORIZONTAL
const V = Gtk.Orientation.VERTICAL

const VITTAE_DIR = `${GLib.get_home_dir()}/vittae`
const TODO_DIR = `${VITTAE_DIR}/tarefas`
const TERMINAL = "alacritty"

const ORDERED_FILES = [
  { file: "autodidata.md", label: "Autodidata" },
  { file: "faculdade.md", label: "Faculdade" },
  { file: "pathotech.md", label: "Pathotech" },
  { file: "dell.md", label: "Dell" },
  { file: "sti.md", label: "Sti" },
  { file: "vida.md", label: "Vida" },
]

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

function getRowHeight(monitorIdx = 0): number {
  try {
    const display = Gdk.Display.get_default()
    const monitors = display?.get_monitors()
    const mon = monitors?.get_item(monitorIdx) as Gdk.Monitor | null
    if (mon) {
      const geo = mon.get_geometry()
      if (geo && geo.height > 0) {
        return Math.floor((geo.height - 24 - 10) / 2)
      }
    }
  } catch (_) {}
  return 518
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

interface Task {
  text: string
  done: boolean
}
interface TodoData {
  urgent: Task[]
  pending: Task[]
}

function parseFromString(raw: string): TodoData {
  const lines = raw.split("\n")
  let section: "urgent" | "pending" | "skip" = "skip"
  const urgent: Task[] = []
  const pending: Task[] = []

  for (const line of lines) {
    if (line.includes("[!WARNING]")) {
      section = "urgent"
      continue
    }
    if (line.includes("[!IMPORTANT]")) {
      section = "pending"
      continue
    }
    if (
      line.includes("[!DONE]") ||
      line.includes("[!TIP]") ||
      line.includes("[!CAUTION]")
    ) {
      section = "skip"
      continue
    }
    if (section === "skip") continue

    const m = line.match(/(?:>\s*)?-\s*\[([xX ]?)\]\s*(.+)/)
    if (!m) continue

    const task = { done: m[1].toLowerCase() === "x", text: m[2].trim() }
    if (section === "urgent") urgent.push(task)
    else pending.push(task)
  }

  return { urgent, pending }
}

function buildMarkup(raw: string): string {
  try {
    const { urgent, pending } = parseFromString(raw)
    const lines: string[] = []

    if (urgent.length > 0) {
      lines.push(`<span foreground="#ff6b6b" weight="bold">⚠ Urgente</span>`)
      urgent.forEach((t) =>
        lines.push(
          `<span foreground="${t.done ? "#555555" : "#ffb3b3"}">  ${t.done ? "✓" : "●"} ${esc(t.text)}</span>`
        )
      )
    }

    if (pending.length > 0) {
      if (lines.length > 0) lines.push("")
      lines.push(`<span foreground="#ffd93d" weight="bold">● Pendentes</span>`)
      pending.forEach((t) =>
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

function readFile(path: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok) return ""
    return new TextDecoder().decode(bytes)
  } catch {
    return ""
  }
}

function openInNvim(filePath: string): void {
  try {
    Gio.Subprocess.new(
      [
        "hyprctl",
        "dispatch",
        "exec",
        `[float;center] ${TERMINAL} --class todo-nvim-editor -e nvim "${filePath}"`,
      ],
      Gio.SubprocessFlags.NONE
    )
  } catch (e) {
    console.error("Erro ao abrir nvim:", e)
  }
}

function TodoCard(filename: string, label: string, rowHeight = 518): Gtk.Widget {
  const filePath = `${TODO_DIR}/${filename}`
  const bodyLabel = new Gtk.Label({
    halign: Gtk.Align.FILL,
    valign: Gtk.Align.START,
    hexpand: true,
    vexpand: false,
    xalign: 0,
    wrap: true,
    wrapMode: Pango.WrapMode.WORD_CHAR,
    useMarkup: true,
    cssClasses: ["todo-card-body"],
  })

  bodyLabel.set_label(buildMarkup(readFile(filePath)))

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => {
    bodyLabel.set_label(buildMarkup(readFile(filePath)))
    return GLib.SOURCE_CONTINUE
  })

  const maxScrollHeight = Math.max(80, rowHeight - 42)

  const scrolled = new Gtk.ScrolledWindow()
  scrolled.set_hexpand(true)
  scrolled.set_vexpand(true)
  scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  scrolled.set_overlay_scrolling(true)
  scrolled.set_propagate_natural_height(false)
  scrolled.set_propagate_natural_width(false)
  scrolled.set_min_content_height(30)
  scrolled.set_max_content_height(maxScrollHeight)
  scrolled.add_css_class("todo-scrolled")
  scrolled.set_child(bodyLabel)

  const card = (
    <box
      class="todo-card"
      orientation={V}
      spacing={6}
      hexpand={true}
      vexpand={true}
      heightRequest={rowHeight}
    >
      <label
        class="todo-card-title"
        label={label}
        halign={Gtk.Align.START}
      />
      <box class="todo-divider" heightRequest={1} />
      {scrolled}
    </box>
  ) as Gtk.Widget

  card.set_overflow(Gtk.Overflow.HIDDEN)

  const gesture = new Gtk.GestureClick()
  gesture.set_button(1)
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    if (nPress === 2) openInNvim(filePath)
  })
  card.add_controller(gesture)

  return card
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: Painel de Streaks de Hábitos (habitos.csv) com Ícones Nerd Font
// ─────────────────────────────────────────────────────────────────────────────

interface HabitSummary {
  key: string
  name: string
  icon: string
  streak: number
  maxStreak: number
  doneToday: boolean
  history: boolean[]
}

const HABIT_DEFS = [
  { key: "meditacao", name: "Meditação", icon: "󰤄" },
  { key: "exercicio", name: "Exercício", icon: "󰓥" },
  { key: "leitura", name: "Leitura", icon: "" },
  { key: "ingles", name: "Inglês", icon: "󰗊" },
  { key: "estudo", name: "Estudo", icon: "󰑴" },
  { key: "vicio", name: "Sem Vício", icon: "" },
]

function parseHabits(): HabitSummary[] {
  try {
    const raw = readFile(`${VITTAE_DIR}/habitos.csv`)
    if (!raw) return []
    const lines = raw.split("\n")
    if (lines.length < 2) return []

    const header = lines[0].split(",").map((s) => s.trim().toLowerCase())
    const colIndices: Record<string, number> = {}
    HABIT_DEFS.forEach((h) => {
      const idx = header.indexOf(h.key)
      if (idx !== -1) colIndices[h.key] = idx
    })

    interface DailyRecord {
      date: string
      habits: Record<string, boolean>
    }

    const records: DailyRecord[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(",").map((s) => s.trim())
      const dateStr = parts[0]
      if (!dateStr) continue

      const habitVals: Record<string, boolean> = {}
      HABIT_DEFS.forEach((h) => {
        const idx = colIndices[h.key]
        const val = idx !== undefined && parts[idx] ? parts[idx] : ""
        habitVals[h.key] = val.includes("✅")
      })

      records.push({ date: dateStr, habits: habitVals })
    }

    records.sort((a, b) => a.date.localeCompare(b.date))

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

    return HABIT_DEFS.map((h) => {
      const vals = records.map((r) => ({
        date: r.date,
        done: r.habits[h.key] || false,
      }))

      let currentStreak = 0
      const n = vals.length
      if (n > 0) {
        for (let i = n - 1; i >= 0; i--) {
          if (vals[i].done) {
            currentStreak++
          } else {
            if (i === n - 1 && n > 1 && vals[i - 1].done) {
              continue
            }
            break
          }
        }
      }

      let maxStreak = 0
      let tempStreak = 0
      vals.forEach((v) => {
        if (v.done) {
          tempStreak++
          if (tempStreak > maxStreak) maxStreak = tempStreak
        } else {
          tempStreak = 0
        }
      })

      const todayRecord =
        records.find((r) => r.date === todayStr) ||
        (records.length > 0 ? records[records.length - 1] : null)
      const doneToday = todayRecord ? todayRecord.habits[h.key] || false : false

      const recent = vals.slice(-7).map((v) => v.done)
      while (recent.length < 7) recent.unshift(false)

      return {
        key: h.key,
        name: h.name,
        icon: h.icon,
        streak: currentStreak,
        maxStreak: Math.max(maxStreak, currentStreak),
        doneToday,
        history: recent,
      }
    })
  } catch (e) {
    console.error("Erro ao ler habitos.csv:", e)
    return []
  }
}

function HabitsStreakPanel(panelHeight: number): Gtk.Widget {
  const filePath = `${VITTAE_DIR}/habitos.csv`
  const habitsBox = new Gtk.Box({
    orientation: H,
    spacing: 6,
    homogeneous: true,
    hexpand: true,
    vexpand: true,
  })

  function refreshHabits() {
    const data = parseHabits()
    let child = habitsBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      habitsBox.remove(child)
      child = next
    }

    data.forEach((h) => {
      const dots = h.history
        .map((done) => (done ? `<span foreground="#4ade80">●</span>` : `<span foreground="#334155">○</span>`))
        .join(" ")

      const streakText =
        h.streak > 0
          ? `<span foreground="#fb923c" weight="heavy">🔥 ${h.streak}d</span>`
          : `<span foreground="#64748b" weight="bold">0d</span>`

      const todayBadge = h.doneToday
        ? `<span foreground="#4ade80" weight="bold">✓ Feito</span>`
        : `<span foreground="#94a3b8" weight="bold">○ Pendente</span>`

      const cardLabel = new Gtk.Label({
        useMarkup: true,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        xalign: 0.5,
        yalign: 0.5,
        hexpand: true,
        label: `<span size="large">${h.icon}</span> <b>${h.name}</b>\n${streakText} <span size="small" foreground="#64748b">(${h.maxStreak}d max)</span>\n${dots}\n${todayBadge}`,
      })

      const card = (
        <box
          class={`habit-mini-card ${h.doneToday ? "habit-done" : ""}`}
          orientation={V}
          hexpand={true}
          vexpand={true}
          halign={Gtk.Align.FILL}
          valign={Gtk.Align.FILL}
        >
          {cardLabel}
        </box>
      ) as Gtk.Widget

      habitsBox.append(card)
    })
  }

  refreshHabits()

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    refreshHabits()
    return GLib.SOURCE_CONTINUE
  })

  const panel = (
    <box
      class="dashboard-card habits-panel"
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={false}
      heightRequest={panelHeight}
    >
      {habitsBox}
    </box>
  ) as Gtk.Widget

  panel.set_overflow(Gtk.Overflow.HIDDEN)

  const gesture = new Gtk.GestureClick()
  gesture.set_button(1)
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    if (nPress === 2) openInNvim(filePath)
  })
  panel.add_controller(gesture)

  return panel
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE 1: Gráfico de Linhas de Horas de Estudo por Semana (registros.csv)
// ─────────────────────────────────────────────────────────────────────────────

interface WeekData {
  key: string
  label: string
  hours: number
  monday: Date
}

function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0
  let h = 0
  let m = 0
  const hMatch = timeStr.match(/(\d+)\s*h/i)
  const mMatch = timeStr.match(/(\d+)\s*m/i)
  if (hMatch) h = parseInt(hMatch[1], 10)
  if (mMatch) m = parseInt(mMatch[1], 10)
  if (!hMatch && !mMatch) {
    const n = parseFloat(timeStr)
    if (!isNaN(n)) return n
  }
  return h + m / 60
}

function getWeekInfo(dateStr: string): { key: string; label: string; monday: Date } | null {
  const parts = dateStr.trim().split("-")
  if (parts.length !== 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null

  const date = new Date(y, m, d)
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`

  const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`
  const label = `${fmt(monday)} - ${fmt(sunday)}`
  return { key, label, monday }
}

function readStudyWeeks(): WeekData[] {
  try {
    const raw = readFile(`${VITTAE_DIR}/registros.csv`)
    if (!raw) return []
    const lines = raw.split("\n")
    const weekMap = new Map<string, { label: string; monday: Date; hours: number }>()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const firstComma = line.indexOf(",")
      if (firstComma === -1) continue
      const dateStr = line.slice(0, firstComma).trim()

      const rest = line.slice(firstComma + 1)
      const secondComma = rest.indexOf(",")
      if (secondComma === -1) continue
      const rest2 = rest.slice(secondComma + 1)
      const thirdComma = rest2.indexOf(",")
      const timeStr = thirdComma === -1 ? rest2.trim() : rest2.slice(0, thirdComma).trim()

      const info = getWeekInfo(dateStr)
      if (!info) continue

      const hours = parseTimeToHours(timeStr)
      if (!weekMap.has(info.key)) {
        weekMap.set(info.key, { label: info.label, monday: info.monday, hours: 0 })
      }
      const entry = weekMap.get(info.key)!
      entry.hours += hours
    }

    const sorted: WeekData[] = Array.from(weekMap.entries())
      .sort((a, b) => a[1].monday.getTime() - b[1].monday.getTime())
      .map(([key, val]) => ({
        key,
        label: val.label,
        hours: Math.round(val.hours * 10) / 10,
        monday: val.monday,
      }))

    if (sorted.length > 0 && sorted.length < 4) {
      const firstMon = sorted[0].monday
      const prevMon = new Date(firstMon)
      prevMon.setDate(firstMon.getDate() - 7)
      const prevSun = new Date(prevMon)
      prevSun.setDate(prevMon.getDate() + 6)
      const fmt = (dt: Date) =>
        `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`
      const prevKey = `${prevMon.getFullYear()}-${String(prevMon.getMonth() + 1).padStart(2, "0")}-${String(prevMon.getDate()).padStart(2, "0")}`

      const lastMon = sorted[sorted.length - 1].monday
      const nextMon = new Date(lastMon)
      nextMon.setDate(lastMon.getDate() + 7)
      const nextSun = new Date(nextMon)
      nextSun.setDate(nextMon.getDate() + 6)
      const nextKey = `${nextMon.getFullYear()}-${String(nextMon.getMonth() + 1).padStart(2, "0")}-${String(nextMon.getDate()).padStart(2, "0")}`

      return [
        { key: prevKey, label: `${fmt(prevMon)} - ${fmt(prevSun)}`, hours: 0, monday: prevMon },
        ...sorted,
        { key: nextKey, label: `${fmt(nextMon)} - ${fmt(nextSun)}`, hours: 0, monday: nextMon },
      ]
    }

    return sorted
  } catch (e) {
    console.error("Erro ao ler registros.csv:", e)
    return []
  }
}

function drawStudyChart(cr: cairo.Context, width: number, height: number, data: WeekData[]) {
  cr.save()

  const padLeft = 40
  const padRight = 24
  const padTop = 30
  const padBottom = 24
  const plotW = Math.max(10, width - padLeft - padRight)
  const plotH = Math.max(10, height - padTop - padBottom)

  // Floating summary at top-right (Branco com Cinza)
  const validData = data.filter((d) => d.hours > 0)
  const totalHours = validData.reduce((acc, d) => acc + d.hours, 0)
  const avgHours = validData.length > 0 ? (totalHours / validData.length).toFixed(1) : "0"
  const summaryText = `Total: ${totalHours.toFixed(1)}h  |  Média: ${avgHours}h/sem`

  cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
  cr.setFontSize(10)
  const sumExt = cr.textExtents(summaryText)
  const badgeX = width - padRight - sumExt.width - 12
  const badgeY = 5
  cr.setSourceRGBA(0.08, 0.09, 0.12, 0.88)
  cr.rectangle(badgeX, badgeY, sumExt.width + 12, 17)
  cr.fill()
  cr.setSourceRGBA(1.0, 1.0, 1.0, 0.20)
  cr.setLineWidth(1)
  cr.rectangle(badgeX, badgeY, sumExt.width + 12, 17)
  cr.stroke()
  cr.setSourceRGBA(0.92, 0.94, 0.98, 0.95)
  cr.moveTo(badgeX + 6, badgeY + 12)
  cr.showText(summaryText)

  if (data.length === 0) {
    cr.setSourceRGBA(0.6, 0.65, 0.75, 0.6)
    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
    cr.setFontSize(11)
    cr.moveTo(width / 2 - 60, height / 2)
    cr.showText("Sem dados em registros.csv")
    cr.restore()
    return
  }

  const maxVal = Math.max(...data.map((d) => d.hours), 10)
  const step = maxVal > 30 ? 10 : 5
  const yMax = Math.ceil((maxVal * 1.2) / step) * step
  const gridSteps = Math.min(5, Math.floor(yMax / step))

  // Gridlines horizontais & Rótulos Y
  cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
  cr.setFontSize(9)
  for (let s = 0; s <= gridSteps; s++) {
    const val = s * (yMax / gridSteps)
    const y = padTop + plotH - (val / yMax) * plotH

    cr.setSourceRGBA(1.0, 1.0, 1.0, s === 0 ? 0.14 : 0.05)
    cr.setLineWidth(1)
    cr.newPath()
    cr.moveTo(padLeft, y)
    cr.lineTo(padLeft + plotW, y)
    cr.stroke()

    cr.setSourceRGBA(0.55, 0.62, 0.72, 0.8)
    const labelText = `${Math.round(val)}h`
    const ext = cr.textExtents(labelText)
    cr.moveTo(padLeft - ext.width - 6, y + ext.height / 2)
    cr.showText(labelText)
  }

  const n = data.length
  const points: { x: number; y: number; val: number; label: string }[] = data.map((d, i) => {
    const x = n === 1 ? padLeft + plotW / 2 : padLeft + (i / (n - 1)) * plotW
    const y = padTop + plotH - (d.hours / yMax) * plotH
    return { x, y, val: d.hours, label: d.label }
  })

  // Gradiente preenchido sob a curva (Light Purple)
  if (points.length > 1) {
    cr.newPath()
    cr.moveTo(points[0].x, padTop + plotH)
    cr.lineTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length; i++) {
      const pPrev = points[i - 1]
      const pCurr = points[i]
      const cx1 = pPrev.x + (pCurr.x - pPrev.x) / 2
      const cy1 = pPrev.y
      const cx2 = pPrev.x + (pCurr.x - pPrev.x) / 2
      const cy2 = pCurr.y
      cr.curveTo(cx1, cy1, cx2, cy2, pCurr.x, pCurr.y)
    }

    cr.lineTo(points[points.length - 1].x, padTop + plotH)
    cr.closePath()

    cr.setSourceRGBA(0.75, 0.52, 0.99, 0.15)
    cr.fill()
  }

  // Linha conectora suave (Light Purple #c084fc)
  cr.newPath()
  cr.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    const pPrev = points[i - 1]
    const pCurr = points[i]
    const cx1 = pPrev.x + (pCurr.x - pPrev.x) / 2
    const cy1 = pPrev.y
    const cx2 = pPrev.x + (pCurr.x - pPrev.x) / 2
    const cy2 = pCurr.y
    cr.curveTo(cx1, cy1, cx2, cy2, pCurr.x, pCurr.y)
  }
  cr.setSourceRGBA(0.75, 0.52, 0.99, 0.95)
  cr.setLineWidth(2.6)
  cr.stroke()

  // Pontos, Valores e Eixo X
  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    // Halo externo roxo claro
    cr.setSourceRGBA(0.75, 0.52, 0.99, 0.25)
    cr.arc(p.x, p.y, 6.0, 0, 2 * Math.PI)
    cr.fill()

    // Ponto sólido roxo claro
    cr.setSourceRGBA(0.75, 0.52, 0.99, 1.0)
    cr.arc(p.x, p.y, 3.5, 0, 2 * Math.PI)
    cr.fill()

    // Ponto central branco
    cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0)
    cr.arc(p.x, p.y, 1.5, 0, 2 * Math.PI)
    cr.fill()

    // Valor acima do ponto (negrito)
    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
    cr.setFontSize(10)
    cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95)
    const valText = `${p.val}h`
    const valExt = cr.textExtents(valText)
    cr.moveTo(p.x - valExt.width / 2, Math.max(12, p.y - 7))
    cr.showText(valText)

    // Rótulo da semana abaixo (negrito)
    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
    cr.setFontSize(8.5)
    cr.setSourceRGBA(0.65, 0.72, 0.82, 0.85)
    const lblExt = cr.textExtents(p.label)
    cr.moveTo(p.x - lblExt.width / 2, padTop + plotH + 15)
    cr.showText(p.label)
  }

  cr.restore()
}

function StudyHoursChart(cardHeight: number): Gtk.Widget {
  const filePath = `${VITTAE_DIR}/registros.csv`

  const drawingArea = new Gtk.DrawingArea({
    hexpand: true,
    vexpand: true,
  })

  let currentData = readStudyWeeks()

  drawingArea.set_draw_func((_area, cr, width, height) => {
    drawStudyChart(cr, width, height, currentData)
  })

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => {
    currentData = readStudyWeeks()
    drawingArea.queue_draw()
    return GLib.SOURCE_CONTINUE
  })

  const card = (
    <box
      class="dashboard-card"
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      heightRequest={cardHeight}
    >
      <box class="chart-container" hexpand={true} vexpand={true}>
        {drawingArea}
      </box>
    </box>
  ) as Gtk.Widget

  card.set_overflow(Gtk.Overflow.HIDDEN)

  const gesture = new Gtk.GestureClick()
  gesture.set_button(1)
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    if (nPress === 2) openInNvim(filePath)
  })
  card.add_controller(gesture)

  return card
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE 2: Tabela Viva do Cronograma (cronograma.csv) + Notificações
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleRow {
  timeStr: string
  startHour: number
  endHour: number
  activities: string[]
}

function parseCronogramaCSV(): ScheduleRow[] {
  try {
    const raw = readFile(`${VITTAE_DIR}/cronograma.csv`)
    if (!raw) return []
    const lines = raw.split("\n")
    const rows: ScheduleRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(",")
      if (parts.length < 8) continue

      const timeStr = parts[0].trim()
      const activities = parts.slice(1, 8).map((p) => p.trim())

      const m = timeStr.match(/(\d+):00\s*-\s*(\d+):00/)
      let startHour = 0
      let endHour = 0
      if (m) {
        startHour = parseInt(m[1], 10)
        endHour = parseInt(m[2], 10)
      }

      rows.push({ timeStr, startHour, endHour, activities })
    }
    return rows
  } catch (e) {
    console.error("Erro ao ler cronograma.csv:", e)
    return []
  }
}

function getActivityClass(act: string): string {
  const norm = act.trim().toLowerCase()
  if (norm.includes("faculd")) return "act-faculdade"
  if (norm.includes("estud")) return "act-estudar"
  if (norm.includes("trabalh")) return "act-trabalho"
  if (norm.includes("ingl")) return "act-ingles"
  if (norm.includes("dorm")) return "act-dormir"
  if (norm.includes("xuxi")) return "act-xuxis"
  if (norm.includes("bus")) return "act-busao"
  if (norm.includes("leitur")) return "act-leitura"
  if (norm.includes("livre")) return "act-livre"
  if (norm.includes("acad") || norm.includes("exerc")) return "act-academia"
  if (norm.includes("medita")) return "act-meditacao"
  if (norm.includes("almo") || norm.includes("janta")) return "act-alimentacao"
  return "act-default"
}

// ── Notificações Inteligentes do Cronograma ───────────────────────────────────
let lastNotifiedActivity = ""

const ACTIVITY_NOTIF_INFO: Record<string, { emoji: string; desc: string }> = {
  faculd: { emoji: "🎓", desc: "Horário de Faculdade" },
  estud: { emoji: "📚", desc: "Foco nos Estudos" },
  trabalh: { emoji: "💼", desc: "Horário de Trabalho" },
  ingl: { emoji: "💬", desc: "Prática de Inglês" },
  dorm: { emoji: "💤", desc: "Hora de Dormir / Descanso" },
  xuxi: { emoji: "💖", desc: "Momento com Xuxis" },
  bus: { emoji: "🚌", desc: "Deslocamento / Busão" },
  leitur: { emoji: "📖", desc: "Hora da Leitura" },
  livre: { emoji: "🎮", desc: "Tempo Livre" },
  acad: { emoji: "🏋️", desc: "Treino / Academia" },
  exerc: { emoji: "🏋️", desc: "Treino / Exercício" },
  medita: { emoji: "🧘", desc: "Momento de Meditação" },
  almo: { emoji: "🍱", desc: "Horário de Almoço" },
  janta: { emoji: "🍲", desc: "Horário de Jantar" },
}

function getActNotifDetails(act: string) {
  const norm = act.toLowerCase()
  for (const [key, val] of Object.entries(ACTIVITY_NOTIF_INFO)) {
    if (norm.includes(key)) return val
  }
  return { emoji: "📌", desc: act }
}

function checkScheduleNotification(rows: ScheduleRow[], currentDayIdx: number, activeRowIdx: number) {
  if (activeRowIdx < 0 || activeRowIdx >= rows.length) return
  const row = rows[activeRowIdx]
  const currentAct = (row.activities[currentDayIdx] || "").trim()
  if (!currentAct) return

  // Filtra repetições consecutivas (ex: Dormir 6 vezes só notifica a 1ª vez)
  if (currentAct !== lastNotifiedActivity) {
    lastNotifiedActivity = currentAct
    const details = getActNotifDetails(currentAct)
    const title = `${details.emoji} ${currentAct}`
    const body = `${details.desc} • ${row.timeStr}`

    try {
      Gio.Subprocess.new(
        ["notify-send", "-a", "Cronograma", "-i", "appointment-soon", title, body],
        Gio.SubprocessFlags.NONE
      )
    } catch (e) {
      console.error("Erro ao enviar notificação:", e)
    }

    try {
      Gio.Subprocess.new(
        ["canberra-gtk-play", "-i", "message"],
        Gio.SubprocessFlags.NONE
      )
    } catch (_) {
      try {
        Gio.Subprocess.new(
          ["paplay", "/usr/share/sounds/freedesktop/stereo/message.oga"],
          Gio.SubprocessFlags.NONE
        )
      } catch (_) {}
    }
  }
}

function LiveScheduleTable(rowHeight = 518): Gtk.Widget {
  const filePath = `${VITTAE_DIR}/cronograma.csv`

  const grid = new Gtk.Grid({
    columnSpacing: 2,
    rowSpacing: 1,
    hexpand: true,
    vexpand: true,
    columnHomogeneous: false,
    rowHomogeneous: true,
    cssClasses: ["sched-grid"],
  })

  function refreshSchedule() {
    const rows = parseCronogramaCSV()
    const now = new Date()
    const jsDay = now.getDay()
    const currentDayIdx = jsDay === 0 ? 6 : jsDay - 1
    const currentHour = now.getHours()

    let activeRowIdx = -1
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      if (row.startHour === 23 && row.endHour === 0) {
        if (currentHour === 23) {
          activeRowIdx = r
          break
        }
      } else if (currentHour >= row.startHour && currentHour < row.endHour) {
        activeRowIdx = r
        break
      }
    }

    // Processa lógica de notificação automática ao mudar de atividade
    checkScheduleNotification(rows, currentDayIdx, activeRowIdx)

    let child = grid.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      grid.remove(child)
      child = next
    }

    // 1. Cabeçalho (Linha 0 do Grid)
    const timeColHead = new Gtk.Label({
      label: "Hora",
      cssClasses: ["sched-col-header", "time-col"],
      halign: Gtk.Align.CENTER,
      xalign: 0.5,
      hexpand: false,
      widthRequest: 48,
    })
    grid.attach(timeColHead, 0, 0, 1, 1)

    DAY_NAMES.forEach((dName, dIdx) => {
      const isToday = dIdx === currentDayIdx
      const dayHead = new Gtk.Label({
        label: isToday ? `${dName.slice(0, 3)}*` : dName.slice(0, 3),
        cssClasses: isToday ? ["sched-col-header", "today"] : ["sched-col-header"],
        halign: Gtk.Align.FILL,
        xalign: 0.5,
        hexpand: true,
      })
      grid.attach(dayHead, dIdx + 1, 0, 1, 1)
    })

    // 2. Linhas do Cronograma (Linhas 1 a N do Grid)
    rows.forEach((row, rIdx) => {
      const gridRow = rIdx + 1

      const compactTime = `${row.startHour}h-${row.endHour}h`
      const timeLabel = new Gtk.Label({
        label: compactTime,
        cssClasses: ["sched-time-cell"],
        halign: Gtk.Align.CENTER,
        xalign: 0.5,
        hexpand: false,
        widthRequest: 48,
      })
      grid.attach(timeLabel, 0, gridRow, 1, 1)

      row.activities.forEach((act, dIdx) => {
        let stateClass = "future"
        if (dIdx < currentDayIdx) {
          stateClass = "past"
        } else if (dIdx === currentDayIdx) {
          if (rIdx < activeRowIdx) stateClass = "past"
          else if (rIdx === activeRowIdx) stateClass = "current"
          else stateClass = "future"
        } else {
          stateClass = "future"
        }

        const actClass = getActivityClass(act)

        const cellLabel = new Gtk.Label({
          label: act,
          halign: Gtk.Align.CENTER,
          valign: Gtk.Align.CENTER,
          xalign: 0.5,
          yalign: 0.5,
          hexpand: true,
          vexpand: true,
        })

        const cellBtn = new Gtk.Button({
          child: cellLabel,
          hexpand: true,
          vexpand: true,
          halign: Gtk.Align.FILL,
          valign: Gtk.Align.FILL,
          cssClasses: ["sched-cell", actClass, stateClass],
        })

        cellBtn.connect("clicked", () => {
          openInNvim(filePath)
        })

        grid.attach(cellBtn, dIdx + 1, gridRow, 1, 1)
      })
    })
  }

  refreshSchedule()

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
    refreshSchedule()
    return GLib.SOURCE_CONTINUE
  })

  const card = (
    <box
      class="dashboard-card"
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      heightRequest={rowHeight}
    >
      <box class="sched-table-wrapper" orientation={V} hexpand={true} vexpand={true}>
        {grid}
      </box>
    </box>
  ) as Gtk.Widget

  card.set_overflow(Gtk.Overflow.HIDDEN)

  const gesture = new Gtk.GestureClick()
  gesture.set_button(1)
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    if (nPress === 2) openInNvim(filePath)
  })
  card.add_controller(gesture)

  return card
}

// ─────────────────────────────────────────────────────────────────────────────
// JANELA PRINCIPAL TODOCARDS (Gráficos no Topo + Cards de Tarefas na Base)
// ─────────────────────────────────────────────────────────────────────────────

export function TodoCards(monitor = 0): Astal.Window {
  const rowHeight = getRowHeight(monitor)

  const habitsHeight = Math.floor((rowHeight - 8) * 0.20)
  const chartHeight = rowHeight - 8 - habitsHeight

  const topLeftColumn = (
    <box
      orientation={V}
      spacing={8}
      hexpand={true}
      vexpand={true}
      heightRequest={rowHeight}
      class="todo-top-left-col"
    >
      {HabitsStreakPanel(habitsHeight)}
      {StudyHoursChart(chartHeight)}
    </box>
  ) as Gtk.Widget

  const topRow = (
    <box
      orientation={H}
      spacing={10}
      hexpand={true}
      vexpand={true}
      homogeneous={true}
      halign={Gtk.Align.FILL}
      heightRequest={rowHeight}
      class="todo-top-row"
    >
      {topLeftColumn}
      {LiveScheduleTable(rowHeight)}
    </box>
  ) as Gtk.Widget

  const bottomRow = (
    <box
      orientation={H}
      spacing={8}
      hexpand={true}
      vexpand={true}
      homogeneous={true}
      halign={Gtk.Align.FILL}
      heightRequest={rowHeight}
      class="todo-bottom-row"
    >
      {ORDERED_FILES.map(({ file, label }) => TodoCard(file, label, rowHeight))}
    </box>
  ) as Gtk.Widget

  const mainBox = (
    <box
      orientation={V}
      spacing={10}
      hexpand={true}
      vexpand={true}
      homogeneous={true}
      class="todo-main-box"
    >
      {topRow}
      {bottomRow}
    </box>
  ) as Gtk.Widget

  return (
    <window
      name="todo-cards"
      class="TodoCards"
      monitor={monitor}
      application={app}
      visible={false}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | LEFT | RIGHT | BOTTOM}
      layer={Astal.Layer.BOTTOM}
      marginTop={12}
      marginLeft={12}
      marginRight={12}
      marginBottom={12}
    >
      {mainBox}
    </window>
  ) as Astal.Window
}

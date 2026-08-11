// LifeManager.tsx
// Painel direito: radar semanal · toggles + sparklines · timers · heatmap
// Requer: sqlite3 no PATH, AGS + Astal GTK4
//
// IPC para keybind/walker:
//   ags request '{"action":"toggle","tracker":"estudo"}'
//   ags request '{"action":"toggle","tracker":"pathotech"}'
//   ags request '{"action":"toggle","tracker":"dell"}'
//   ags request '{"action":"toggle","tracker":"sti"}'

import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

const { TOP, BOTTOM, RIGHT } = Astal.WindowAnchor
const V = Gtk.Orientation.VERTICAL
const H = Gtk.Orientation.HORIZONTAL

// ─── Paths ───────────────────────────────────────────────────────────
const DB_DIR  = `${GLib.get_home_dir()}/.config/life-manager`
const DB_PATH = `${DB_DIR}/life.sqlite`

// ─── SQLite wrapper ──────────────────────────────────────────────────
function sql(query: string): string {
  try {
    const [ok, out] = GLib.spawn_sync(
      null,
      ["sqlite3", DB_PATH, query],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    )
    return ok && out ? new TextDecoder().decode(out as Uint8Array).trim() : ""
  } catch (e) {
    console.error("[life-manager] sqlite3:", e)
    return ""
  }
}

function initDB() {
  GLib.mkdir_with_parents(DB_DIR, 0o755)
  sql(`CREATE TABLE IF NOT EXISTS toggles(
    date TEXT, metric TEXT, value INTEGER DEFAULT 0,
    PRIMARY KEY(date, metric)
  )`)
  sql(`CREATE TABLE IF NOT EXISTS sessions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, tracker TEXT,
    started_at INTEGER, ended_at INTEGER,
    duration INTEGER DEFAULT 0
  )`)
}

// ─── Utils ───────────────────────────────────────────────────────────
function isoDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
}

function hexRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1,3), 16) / 255,
    parseInt(hex.slice(3,5), 16) / 255,
    parseInt(hex.slice(5,7), 16) / 255,
  ]
}

// ─── Toggle definitions ──────────────────────────────────────────────
const TOGGLE_DEFS = [
  { key: "vicio",     label: "Vício",     icon: "🚬", color: "#ff6b6b", invert: true  },
  { key: "leitura",   label: "Leitura",   icon: "📚", color: "#60a5fa", invert: false },
  { key: "exercicio", label: "Exercício", icon: "🏋️", color: "#4ade80", invert: false },
  { key: "meditacao", label: "Meditação", icon: "🧘", color: "#a78bfa", invert: false },
  { key: "ingles",    label: "Inglês",    icon: "🗣️", color: "#ffd93d", invert: false },
] as const

// ─── Toggle DB ops ───────────────────────────────────────────────────
function getToggle(metric: string): boolean {
  return sql(`SELECT value FROM toggles WHERE date='${isoDate()}' AND metric='${metric}'`) === "1"
}

function setToggle(metric: string, val: boolean) {
  sql(`INSERT OR REPLACE INTO toggles(date,metric,value) VALUES('${isoDate()}','${metric}',${val ? 1 : 0})`)
}

function toggleHistory(metric: string, days = 14): number[] {
  return Array.from({ length: days }, (_, i) =>
    sql(`SELECT value FROM toggles WHERE date='${isoDate(days - 1 - i)}' AND metric='${metric}'`) === "1" ? 1 : 0
  )
}

// ─── Session DB ops ──────────────────────────────────────────────────
function sessionStart(tracker: string): number {
  const now = Math.floor(Date.now() / 1000)
  sql(`INSERT INTO sessions(date,tracker,started_at) VALUES('${isoDate()}','${tracker}',${now})`)
  return parseInt(sql("SELECT last_insert_rowid()")) || 0
}

function sessionEnd(id: number) {
  const now = Math.floor(Date.now() / 1000)
  sql(`UPDATE sessions SET ended_at=${now}, duration=(${now}-started_at) WHERE id=${id}`)
}

function todaySecs(tracker: string): number {
  return parseInt(sql(
    `SELECT COALESCE(SUM(duration),0) FROM sessions WHERE date='${isoDate()}' AND tracker='${tracker}' AND ended_at IS NOT NULL`
  )) || 0
}

// ─── In-memory timer state ───────────────────────────────────────────
type TimerState = { active: boolean; sid: number; startAt: number; base: number }
const timers: Record<string, TimerState> = {}
// Callbacks registrados para atualizar UI quando IPC muda o timer
const timerCallbacks: Record<string, Array<() => void>> = {}

function timerOf(key: string): TimerState {
  if (!timers[key]) {
    timers[key] = { active: false, sid: 0, startAt: 0, base: todaySecs(key) }
  }
  return timers[key]
}

function currentSecs(key: string): number {
  const t = timerOf(key)
  return t.active ? t.base + Math.floor(Date.now() / 1000 - t.startAt) : t.base
}

export function toggleTimer(key: string): "started" | "stopped" {
  const t = timerOf(key)
  if (t.active) {
    sessionEnd(t.sid)
    t.base = currentSecs(key)
    t.active = false
    timerCallbacks[key]?.forEach(cb => cb())
    return "stopped"
  } else {
    t.sid = sessionStart(key)
    t.startAt = Math.floor(Date.now() / 1000)
    t.active = true
    timerCallbacks[key]?.forEach(cb => cb())
    return "started"
  }
}

// ─── Chart data ──────────────────────────────────────────────────────
function radarScores(): number[] {
  return TOGGLE_DEFS.map(({ key, invert }) => {
    let count = 0
    for (let d = 0; d < 7; d++) {
      if (sql(`SELECT value FROM toggles WHERE date='${isoDate(d)}' AND metric='${key}'`) === "1") count++
    }
    const v = count / 7
    return invert ? 1 - v : v
  })
}

function heatmapData(days: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const d = isoDate(days - 1 - i)
    return parseInt(sql(`SELECT COALESCE(SUM(value),0) FROM toggles WHERE date='${d}'`)) || 0
  })
}

// ─── Widget: Radar Chart ─────────────────────────────────────────────
function RadarChart(): Gtk.Widget {
  const da = new Gtk.DrawingArea()
  da.set_size_request(264, 264)
  da.set_hexpand(true)

  const axisLabels = ["Vício*", "Leitura", "Exerc.", "Medit.", "Inglês"]
  const n = axisLabels.length

  da.set_draw_func((_w, cr, W, H) => {
    const cx = W / 2
    const cy = H / 2
    const R  = Math.min(W, H) / 2 - 32
    const scores = radarScores()

    const angle = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
    const pt    = (i: number, r: number): [number, number] => [
      cx + Math.cos(angle(i)) * r,
      cy + Math.sin(angle(i)) * r,
    ]

    // Grid rings
    for (let ring = 1; ring <= 4; ring++) {
      cr.setSourceRGBA(0.35, 0.35, 0.58, ring === 4 ? 0.35 : 0.18)
      cr.setLineWidth(ring === 4 ? 0.8 : 0.5)
      for (let i = 0; i < n; i++) {
        const [x, y] = pt(i, ring / 4 * R)
        i === 0 ? cr.moveTo(x, y) : cr.lineTo(x, y)
      }
      cr.closePath()
      cr.stroke()
    }

    // Axes
    for (let i = 0; i < n; i++) {
      cr.setSourceRGBA(0.4, 0.4, 0.6, 0.3)
      cr.setLineWidth(0.5)
      const [x, y] = pt(i, R)
      cr.moveTo(cx, cy)
      cr.lineTo(x, y)
      cr.stroke()
    }

    // Data fill
    cr.setSourceRGBA(0.37, 0.67, 0.93, 0.2)
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, scores[i] * R)
      i === 0 ? cr.moveTo(x, y) : cr.lineTo(x, y)
    }
    cr.closePath()
    cr.fill()

    // Data stroke
    cr.setSourceRGBA(0.37, 0.67, 0.93, 0.88)
    cr.setLineWidth(1.6)
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, scores[i] * R)
      i === 0 ? cr.moveTo(x, y) : cr.lineTo(x, y)
    }
    cr.closePath()
    cr.stroke()

    // Data points
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, scores[i] * R)
      cr.setSourceRGBA(0.37, 0.67, 0.93, 1)
      cr.arc(x, y, 3.5, 0, 2 * Math.PI)
      cr.fill()
    }

    // Axis labels
    cr.setFontSize(10)
    for (let i = 0; i < n; i++) {
      const [lx, ly] = pt(i, R + 19)
      const ext = cr.textExtents(axisLabels[i])
      cr.setSourceRGBA(0.75, 0.80, 0.92, 0.85)
      cr.moveTo(lx - ext.width / 2, ly + ext.height / 2)
      cr.showText(axisLabels[i])
    }

    // Score labels on points
    cr.setFontSize(9)
    for (let i = 0; i < n; i++) {
      const [px, py] = pt(i, scores[i] * R + 10)
      const pct = `${Math.round(scores[i] * 100)}%`
      const ext = cr.textExtents(pct)
      cr.setSourceRGBA(0.37, 0.67, 0.93, 0.7)
      cr.moveTo(px - ext.width / 2, py + ext.height / 2)
      cr.showText(pct)
    }
  })

  // Refresh radar a cada 5 min (dados semanais não mudam rápido)
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300_000, () => {
    da.queue_draw()
    return GLib.SOURCE_CONTINUE
  })

  return da
}

// ─── Widget: Heatmap ─────────────────────────────────────────────────
function Heatmap(): Gtk.Widget {
  const CELL = 11, GAP = 3, COLS = 13, ROWS = 7
  const XOFF = 14   // espaço pros labels de dia da semana
  const TOPOFF = 16 // espaço pro topo (alinhado com os labels)

  const da = new Gtk.DrawingArea()
  da.set_size_request(XOFF + COLS * (CELL + GAP) + GAP, ROWS * (CELL + GAP) + GAP + TOPOFF)
  da.set_hexpand(true)

  da.set_draw_func((_w, cr, _W, _H) => {
    const data = heatmapData(COLS * ROWS)

    // Weekday labels
    cr.setFontSize(8)
    cr.setSourceRGBA(0.45, 0.48, 0.60, 0.55)
    ;["D","S","T","Q","Q","S","S"].forEach((d, i) => {
      cr.moveTo(0, TOPOFF + i * (CELL + GAP) + CELL - 1)
      cr.showText(d)
    })

    // Cells
    data.forEach((score, i) => {
      const col = Math.floor(i / ROWS)
      const row = i % ROWS
      const x   = XOFF + GAP + col * (CELL + GAP)
      const y   = TOPOFF + GAP + row * (CELL + GAP)
      const t   = Math.min(score / 5, 1)

      if (t === 0) {
        cr.setSourceRGBA(0.10, 0.10, 0.16, 1)
      } else {
        // verde escuro → verde vivo
        cr.setSourceRGBA(0.04 + t * 0.07, 0.27 + t * 0.45, 0.08 + t * 0.12, 1)
      }

      const rad = 2
      cr.moveTo(x + rad, y)
      cr.lineTo(x + CELL - rad, y)
      cr.arc(x + CELL - rad, y + rad,       rad, -Math.PI / 2, 0)
      cr.lineTo(x + CELL, y + CELL - rad)
      cr.arc(x + CELL - rad, y + CELL - rad, rad, 0,           Math.PI / 2)
      cr.lineTo(x + rad, y + CELL)
      cr.arc(x + rad,      y + CELL - rad,   rad, Math.PI / 2, Math.PI)
      cr.lineTo(x, y + rad)
      cr.arc(x + rad,      y + rad,          rad, Math.PI,     -Math.PI / 2)
      cr.closePath()
      cr.fill()
    })
  })

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60_000, () => {
    da.queue_draw()
    return GLib.SOURCE_CONTINUE
  })

  return da
}

// ─── Widget: Toggle row (icon + label + sparkline + switch) ──────────
function ToggleRow(def: typeof TOGGLE_DEFS[number]): Gtk.Widget {
  const { key, label, icon, color } = def
  const [r, g, b] = hexRGB(color)
  let hist = toggleHistory(key)

  // Sparkline inline para ter closure correto sobre `hist`
  const sparkDA = new Gtk.DrawingArea()
  sparkDA.set_size_request(72, 20)
  sparkDA.set_valign(Gtk.Align.CENTER)

  sparkDA.set_draw_func((_w, cr, W, H) => {
    const n = hist.length
    if (n < 2) return
    const step = W / (n - 1)

    // Linha de tendência
    cr.setSourceRGBA(r, g, b, 0.55)
    cr.setLineWidth(1.4)
    hist.forEach((v, i) => {
      const x = i * step
      const y = v === 1 ? 2 : H - 2
      i === 0 ? cr.moveTo(x, y) : cr.lineTo(x, y)
    })
    cr.stroke()

    // Pontos
    hist.forEach((v, i) => {
      cr.arc(i * step, v === 1 ? 2 : H - 2, 2.8, 0, 2 * Math.PI)
      cr.setSourceRGBA(r, g, b, v === 1 ? 1 : 0.12)
      cr.fill()
    })
  })

  const sw = new Gtk.Switch({
    valign: Gtk.Align.CENTER,
    active: getToggle(key),
  })

  sw.connect("state-set", (_sw: Gtk.Switch, state: boolean) => {
    setToggle(key, state)
    hist = toggleHistory(key)
    sparkDA.queue_draw()
    return false  // permite o switch mudar visualmente
  })

  return (
    <box orientation={H} spacing={8} class="toggle-row">
      <label label={`${icon}  ${label}`} halign={Gtk.Align.START} hexpand class="toggle-label" />
      {sparkDA}
      {sw}
    </box>
  ) as Gtk.Widget
}

// ─── Widget: Timer row ───────────────────────────────────────────────
function TimerRow(key: string, label: string, icon: string): Gtk.Widget {
  const t = timerOf(key)
  let tickId = 0

  const timeLabel = new Gtk.Label({
    label: fmtSecs(currentSecs(key)),
    halign: Gtk.Align.END,
  })
  timeLabel.set_css_classes(["timer-time"])

  // Indicador de gravação ao vivo
  const dot = new Gtk.Label({ label: "⏺" })
  dot.set_css_classes(["timer-dot"])
  dot.set_visible(t.active)

  const btnLbl = new Gtk.Label({ label: t.active ? "⏸" : "▶" })
  const btn = new Gtk.Button()
  btn.set_child(btnLbl)
  btn.set_css_classes(["timer-btn"])

  function refresh() {
    timeLabel.set_label(fmtSecs(currentSecs(key)))
    btnLbl.set_label(t.active ? "⏸" : "▶")
    dot.set_visible(t.active)
  }

  // Callback para IPC (walker) atualizar esta row sem re-criar
  if (!timerCallbacks[key]) timerCallbacks[key] = []
  timerCallbacks[key].push(() => {
    if (t.active) {
      // recém iniciado via IPC — começa tick
      tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
        if (!t.active) { tickId = 0; refresh(); return GLib.SOURCE_REMOVE }
        refresh()
        return GLib.SOURCE_CONTINUE
      })
    } else {
      // parado via IPC
      if (tickId) { GLib.source_remove(tickId); tickId = 0 }
    }
    refresh()
  })

  btn.connect("clicked", () => {
    const res = toggleTimer(key)
    if (res === "started") {
      tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
        if (!t.active) { tickId = 0; refresh(); return GLib.SOURCE_REMOVE }
        refresh()
        return GLib.SOURCE_CONTINUE
      })
    } else {
      if (tickId) { GLib.source_remove(tickId); tickId = 0 }
    }
    refresh()
  })

  return (
    <box orientation={H} spacing={8} class="timer-row">
      <label label={`${icon}  ${label}`} halign={Gtk.Align.START} hexpand class="timer-label" />
      {dot}
      {timeLabel}
      {btn}
    </box>
  ) as Gtk.Widget
}

// ─── IPC handler ─────────────────────────────────────────────────────
// Uso: ags request '{"action":"toggle","tracker":"estudo"}'
// Retorno: '{"ok":true,"result":"started"}' ou '{"ok":true,"result":"stopped"}'
//
// Este handler é exportado e deve ser ligado em app.start({ requestHandler })
// no app.ts — não existe mais o sinal "message" no app (AGS v2 / Astal).
export function lifeManagerRequest(request: string, res: (response: unknown) => void) {
  try {
    const { action, tracker } = JSON.parse(request)
    if (action === "toggle" && typeof tracker === "string") {
      const result = toggleTimer(tracker)
      console.log(`[life-manager] ${tracker}: ${result}`)
      return res(JSON.stringify({ ok: true, result }))
    }
  } catch {
    // mensagem não é JSON ou não é para nós
  }
  res(JSON.stringify({ ok: false, error: "unknown command" }))
}

// ─── Janela principal ────────────────────────────────────────────────
export function LifeManager(monitor = 0): Astal.Window {
  initDB()

  // Pré-aquece todos os timers (lê o acumulado do dia do DB)
  ;["estudo", "pathotech", "dell", "sti"].forEach(timerOf)

  return (
    <window
      name="life-manager"
      class="LifeManager"
      monitor={monitor}
      application={app}
      visible={false}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | BOTTOM | RIGHT}
      layer={Astal.Layer.BOTTOM}
      marginTop={12}
      marginBottom={12}
      marginRight={12}
    >
      <box orientation={V} spacing={18} class="life-panel" vexpand>

        {/* ── TOPO: Radar semanal ─────────────────────────────── */}
        <box orientation={V} spacing={6} class="panel-section">
          <box orientation={H} spacing={0}>
            <label label="◎  Radar Semanal" halign={Gtk.Align.START} hexpand class="section-title" />
            <label label="7 dias" halign={Gtk.Align.END} class="section-badge" />
          </box>
          <label label="* Vício: inverso — 100% = sem recaída" halign={Gtk.Align.START} class="section-hint" />
          {RadarChart()}
        </box>

        <box class="lm-divider" />

        {/* ── MEIO: Toggles do dia ────────────────────────────── */}
        <box orientation={V} spacing={8} class="panel-section">
          <label label="◎  Hoje" halign={Gtk.Align.START} class="section-title" />
          {TOGGLE_DEFS.map(t => ToggleRow(t))}
        </box>

        <box class="lm-divider" />

        {/* ── TRACKERS ────────────────────────────────────────── */}
        <box orientation={V} spacing={12} class="panel-section">
          <label label="◎  Trackers" halign={Gtk.Align.START} class="section-title" />

          {/* Estudo */}
          <box orientation={V} spacing={4} class="tracker-group">
            <label label="ESTUDO" halign={Gtk.Align.START} class="group-label" />
            {TimerRow("estudo", "Estudo", "📖")}
          </box>

          {/* Trabalho */}
          <box orientation={V} spacing={4} class="tracker-group">
            <label label="TRABALHO" halign={Gtk.Align.START} class="group-label" />
            {TimerRow("pathotech", "Pathotech", "🏢")}
            {TimerRow("dell",      "Dell",      "💻")}
            {TimerRow("sti",       "STI",       "🖥️")}
          </box>
        </box>

        <box class="lm-divider" />

        {/* ── BASE: Heatmap 3 meses ───────────────────────────── */}
        <box orientation={V} spacing={8} class="panel-section">
          <label label="◎  Streak — 3 meses" halign={Gtk.Align.START} class="section-title" />
          {Heatmap()}
          <label label="cor = Σ hábitos do dia (0 – 5)" halign={Gtk.Align.START} class="section-hint" />
        </box>

      </box>
    </window>
  ) as Astal.Window
}

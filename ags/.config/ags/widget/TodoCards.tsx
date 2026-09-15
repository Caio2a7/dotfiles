import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import GObject from "gi://GObject"
import Pango from "gi://Pango"
import cairo from "gi://cairo"
import { openHabitsModal } from "./HabitsModal"
import {
  readMetas,
  saveMetas,
  readDoneHoursThisWeek,
  parseScheduleStudySlots,
  computeScheduleAllocation,
  TopicoMeta,
  ScheduleAllocationResult,
  AllocatedSlot,
} from "./studyScheduleEngine"

const scheduleRefreshListeners: Array<() => void> = []
export function triggerScheduleRefresh(): void {
  scheduleRefreshListeners.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.error("Erro no listener de schedule refresh:", e)
    }
  })
}

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace("#", "")
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("")
  }
  const num = parseInt(c, 16)
  if (isNaN(num)) return `rgba(148, 163, 184, ${alpha})`
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor
const H = Gtk.Orientation.HORIZONTAL
const V = Gtk.Orientation.VERTICAL

const VITTAE_DIR = `${GLib.get_home_dir()}/vittae`
const TODO_DIR = `${VITTAE_DIR}/tarefas`
const PRIORIDADES_FILE = `${TODO_DIR}/prioridades.md`
const TERMINAL = "alacritty"

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

const WIP_LIMIT = 3

// ─── Metadados Semânticos de Domínio ─────────────────────────────────────────
interface DomainMeta {
  key: string
  name: string
  color: string
  icon: string
}

const DOMAINS: Record<string, DomainMeta> = {
  faculdade: { key: "faculdade", name: "Faculdade", icon: "󰑴", color: "#db2777" }, // Rosa vinho
  estudos: { key: "estudos", name: "Estudos", icon: "󱚌", color: "#34d399" },     // Verde (caneta com livro)
  dell: { key: "dell", name: "Dell", icon: "󰃖", color: "#c48350" },              // Marrom (trabalho)
  pathotech: { key: "pathotech", name: "Pathotech", icon: "󰃖", color: "#c48350" },// Marrom (trabalho)
  sti: { key: "sti", name: "STI", icon: "󰃖", color: "#c48350" },                  // Marrom (trabalho)
  vida: { key: "vida", name: "Vida", icon: "󰖙", color: "#ffffff" },              // Branco (Sol)
}

const DEFAULT_DOMAIN: DomainMeta = {
  key: "geral",
  name: "Geral",
  icon: "󰄲",
  color: "#94a3b8",
}

function getDashboardHeights(monitorIdx = 0): { topHeight: number; bottomHeight: number } {
  try {
    const display = Gdk.Display.get_default()
    const monitors = display?.get_monitors()
    const mon = monitors?.get_item(monitorIdx) as Gdk.Monitor | null
    if (mon) {
      const geo = mon.get_geometry()
      if (geo && geo.height > 0) {
        const totalH = geo.height - 20 - 1 // 1080 - 20 (margins) - 1 (mid divider) = 1059px
        const bottomH = Math.floor(totalH * 0.60) // 60% para a box inferior
        const topH = totalH - bottomH // 40% para a box superior
        return { topHeight: topH, bottomHeight: bottomH }
      }
    }
  } catch (_) {}
  return { topHeight: 424, bottomHeight: 635 }
}

function getDisplayWidth(monitorIdx = 0): number {
  try {
    const display = Gdk.Display.get_default()
    const monitors = display?.get_monitors()
    const mon = monitors?.get_item(monitorIdx) as Gdk.Monitor | null
    if (mon) {
      const geo = mon.get_geometry()
      if (geo && geo.width > 0) {
        return geo.width - 20 - 1 // 1920 - 20 (margins) - 1 (vsep) = 1899px
      }
    }
  } catch (_) {}
  return 1899
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

function toggleTaskInFile(filePath: string, rawText: string): void {
  try {
    const content = readFile(filePath)
    if (!content) return
    const lines = content.split("\n")
    const newLines = lines.map((line) => {
      if (line.includes(rawText)) {
        if (line.includes("- [ ]") || line.includes("- []")) {
          return line.replace(/- \[[ ]?\]/, "- [x]")
        } else if (line.includes("- [x]") || line.includes("- [X]")) {
          return line.replace(/- \[[xX]\]/, "- [ ]")
        }
      }
      return line
    })
    GLib.file_set_contents(filePath, newLines.join("\n"))
  } catch (e) {
    console.error("Erro ao alternar tarefa:", e)
  }
}

// ─── Mover e Reordenar Tarefas (Dentro da mesma seção ou entre seções) ────────

function moveTaskToFile(
  filePath: string,
  sourceRawText: string,
  targetSection: "agora" | "proximo" | "depois",
  targetBeforeRawText?: string
): void {
  try {
    const content = readFile(filePath)
    if (!content) return

    const lines = content.split("\n")
    let extractedLine: string | null = null
    const remainingLines: string[] = []

    for (const line of lines) {
      if (line.includes(sourceRawText) && line.includes("- [") && !extractedLine) {
        extractedLine = line.trim()
      } else {
        remainingLines.push(line)
      }
    }

    if (!extractedLine) return

    if (!extractedLine.startsWith(">")) {
      extractedLine = `> ${extractedLine}`
    }

    const sectionMarkers: Record<string, string> = {
      agora: "[!CAUTION]",
      proximo: "[!WARNING]",
      depois: "[!IMPORTANT]",
    }
    const targetMarker = sectionMarkers[targetSection]
    if (!targetMarker) return

    const allMarkers = ["[!CAUTION]", "[!WARNING]", "[!IMPORTANT]", "[!TIP]", "[!DONE]"]
    const finalLines: string[] = []
    let inserted = false

    if (targetBeforeRawText && targetBeforeRawText !== sourceRawText) {
      for (const line of remainingLines) {
        if (line.includes(targetBeforeRawText) && line.includes("- [") && !inserted) {
          finalLines.push(extractedLine)
          inserted = true
        }
        finalLines.push(line)
      }
    }

    if (!inserted) {
      finalLines.length = 0
      let inTarget = false
      for (let i = 0; i < remainingLines.length; i++) {
        const line = remainingLines[i]
        if (line.includes(targetMarker)) {
          inTarget = true
          finalLines.push(line)
          continue
        }

        if (inTarget && allMarkers.some((m) => line.includes(m) && m !== targetMarker)) {
          finalLines.push(extractedLine)
          finalLines.push("")
          finalLines.push(line)
          inserted = true
          inTarget = false
          continue
        }

        finalLines.push(line)
      }

      if (inTarget && !inserted) {
        finalLines.push(extractedLine)
        inserted = true
      }
    }

    if (!inserted) {
      finalLines.push(extractedLine)
    }

    GLib.file_set_contents(filePath, finalLines.join("\n"))
  } catch (e) {
    console.error("Erro ao mover/reordenar tarefa:", e)
  }
}

// ─── Extração de Domínio e Texto ────────────────────────────────────────────

function extractDomainAndText(rawText: string): { domainKey: string; cleanText: string } {
  const bracketMatch = rawText.match(/^\[([a-zA-Z0-9_\u00C0-\u00FF\s-]+)\]\s*(.+)/)
  if (bracketMatch) {
    const key = bracketMatch[1].trim().toLowerCase()
    if (key === "autodidata") return { domainKey: "estudos", cleanText: bracketMatch[2].trim() }
    return { domainKey: key, cleanText: bracketMatch[2].trim() }
  }

  const prefixMap: Record<string, string> = {
    "󰑴": "faculdade",
    "󱚌": "estudos",
    "": "estudos",
    "󰃖": "dell",
    "󰖙": "vida",
    "": "vida",
    "🎓": "faculdade",
    "💼": "dell",
    "🔬": "pathotech",
    "📚": "estudos",
    "📄": "vida",
  }
  for (const [prefix, dKey] of Object.entries(prefixMap)) {
    if (rawText.startsWith(prefix)) {
      return { domainKey: dKey, cleanText: rawText.slice(prefix.length).trim() }
    }
  }

  return { domainKey: "geral", cleanText: rawText }
}

// ─── Parser do prioridades.md ───────────────────────────────────────────────

interface Task {
  text: string
  rawText: string
  done: boolean
  domainKey: string
}

interface PriorityData {
  agora: Task[]
  proximo: Task[]
  depois: Task[]
  concluidas: Task[]
}

function parsePrioridades(raw: string): PriorityData {
  const lines = raw.split("\n")
  let section: "agora" | "proximo" | "depois" | "concluidas" | "skip" = "skip"
  const result: PriorityData = { agora: [], proximo: [], depois: [], concluidas: [] }

  for (const line of lines) {
    if (line.includes("[!CAUTION]")) { section = "agora"; continue }
    if (line.includes("[!WARNING]")) { section = "proximo"; continue }
    if (line.includes("[!IMPORTANT]")) { section = "depois"; continue }
    if (line.includes("[!TIP]") || line.includes("[!DONE]")) { section = "concluidas"; continue }
    if (section === "skip") continue

    const m = line.match(/(?:>\s*)?-\s*\[([xX ]?)\]\s*(.+)/)
    if (!m) continue

    const rawText = m[2].trim()
    const { domainKey, cleanText } = extractDomainAndText(rawText)

    const task: Task = {
      done: m[1].toLowerCase() === "x",
      text: cleanText,
      rawText,
      domainKey,
    }
    result[section].push(task)
  }

  return result
}

// ─── Componente: Card de Tarefa Individual (Arrastável, com Linha de Inserção)

function TaskCard(
  task: Task,
  sectionKey: "agora" | "proximo" | "depois",
  index: number,
  onRefresh: () => void
): Gtk.Widget {
  const meta = DOMAINS[task.domainKey] || DEFAULT_DOMAIN

  // 1. Linha indicadora de inserção fixa de 2px
  const insertLine = new Gtk.Box({
    orientation: H,
    hexpand: true,
    heightRequest: 2,
    cssClasses: ["task-insert-line"],
  })
  insertLine.can_target = false

  // 2. Tag de Domínio: Apenas o ÍCONE é colorido com a sua cor semântica, o texto é neutro
  const tagLabel = new Gtk.Label({
    useMarkup: true,
    label: `<span foreground="${meta.color}" size="9000">${meta.icon}</span>  <span foreground="#94a3b8" size="8500" weight="bold">${meta.name.toUpperCase()}</span>`,
    cssClasses: ["task-domain-tag"],
  })
  tagLabel.can_target = false

  // 3. Badge de Prioridade Semântica (Carmesim P1, Âmbar P2, Ardósia P3)
  let prioMarkup = ""
  if (sectionKey === "agora") {
    prioMarkup = `<span foreground="#f43f5e" weight="heavy" size="8500">󰀦 P1 • #${index + 1}</span>`
  } else if (sectionKey === "proximo") {
    prioMarkup = `<span foreground="#f59e0b" weight="bold" size="8500">󰅐 P2 • FILA</span>`
  } else {
    prioMarkup = `<span foreground="#64748b" weight="medium" size="8500">󰒊 P3 • BACKLOG</span>`
  }

  const prioLabel = new Gtk.Label({
    useMarkup: true,
    label: prioMarkup,
    halign: Gtk.Align.END,
    hexpand: true,
  })
  prioLabel.can_target = false

  const cardHeader = (
    <box
      orientation={H}
      spacing={6}
      halign={Gtk.Align.FILL}
      hexpand={true}
      class="task-card-header"
    >
      {tagLabel}
      {prioLabel}
    </box>
  ) as Gtk.Widget
  cardHeader.can_target = false

  // 4. Checkbox interativo
  const checkIcon = new Gtk.Label({
    label: task.done ? "󰄵" : "󰄱",
    cssClasses: ["task-check-icon", task.done ? "checked" : "unchecked"],
  })
  checkIcon.can_target = false

  const checkBtn = new Gtk.Button({
    child: checkIcon,
    valign: Gtk.Align.START,
    halign: Gtk.Align.START,
    cssClasses: ["task-check-btn"],
  })
  checkBtn.connect("clicked", () => {
    toggleTaskInFile(PRIORIDADES_FILE, task.rawText)
    onRefresh()
  })

  // 5. Texto da Tarefa
  const titleColor = task.done ? "#64748b" : "#ffffff"
  const titleWeight = sectionKey === "agora" ? "bold" : "600"
  const titleSize = sectionKey === "agora" ? "11500" : "11000"

  const titleLabel = new Gtk.Label({
    useMarkup: true,
    label: `<span foreground="${titleColor}" weight="${titleWeight}" size="${titleSize}">${esc(task.text)}</span>`,
    halign: Gtk.Align.START,
    valign: Gtk.Align.START,
    xalign: 0,
    wrap: true,
    wrapMode: Pango.WrapMode.WORD_CHAR,
    hexpand: true,
    cssClasses: ["task-card-title", task.done ? "task-done" : ""],
  })
  titleLabel.can_target = false

  const cardBody = (
    <box
      orientation={H}
      spacing={10}
      halign={Gtk.Align.FILL}
      hexpand={true}
      class="task-card-body"
    >
      {checkBtn}
      {titleLabel}
    </box>
  ) as Gtk.Widget

  const card = (
    <box
      orientation={V}
      spacing={6}
      halign={Gtk.Align.FILL}
      hexpand={true}
      class={`task-card task-card-${sectionKey} ${task.done ? "task-card-done" : ""}`}
    >
      {cardHeader}
      {cardBody}
    </box>
  ) as Gtk.Widget

  // Wrapper que contém a linha indicadora de inserção logo acima do card
  const cardWrapper = (
    <box orientation={V} spacing={2} halign={Gtk.Align.FILL} hexpand={true} class="task-card-wrapper">
      {insertLine}
      {card}
    </box>
  ) as Gtk.Widget

  // Duplo clique para abrir no Neovim
  const gesture = new Gtk.GestureClick()
  gesture.set_button(1)
  gesture.connect("pressed", (_g: Gtk.GestureClick, nPress: number) => {
    if (nPress === 2) openInNvim(PRIORIDADES_FILE)
  })
  card.add_controller(gesture)

  // Drag Source com Ícone Visual Completo
  const dragSource = new Gtk.DragSource()
  dragSource.set_actions(Gdk.DragAction.MOVE)

  const paintable = new Gtk.WidgetPaintable({ widget: card })
  dragSource.connect("prepare", (_s, x, y) => {
    dragSource.set_icon(paintable, Math.floor(x), Math.floor(y))
    const payload = JSON.stringify({
      rawText: task.rawText,
      fromSection: sectionKey,
    })
    return Gdk.ContentProvider.new_for_value(payload)
  })
  card.add_controller(dragSource)

  // Drop Target com indicador de linha de inserção estável (SEM FLICKER)
  const cardDropTarget = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE)
  cardDropTarget.connect("enter", () => {
    insertLine.add_css_class("active")
    return Gdk.DragAction.MOVE
  })
  cardDropTarget.connect("leave", () => {
    insertLine.remove_css_class("active")
  })
  cardDropTarget.connect("drop", (_target, value: string) => {
    insertLine.remove_css_class("active")
    try {
      const data = JSON.parse(value)
      if (data && data.rawText && data.rawText !== task.rawText) {
        moveTaskToFile(PRIORIDADES_FILE, data.rawText, sectionKey, task.rawText)
        onRefresh()
        return true
      }
    } catch (e) {
      console.error("Erro no drop sobre card:", e)
    }
    return false
  })
  cardWrapper.add_controller(cardDropTarget)

  return cardWrapper
}

// ─── Componente: Seção Interna da Coluna ────────────────────────────────────

function ColumnSection(
  sectionKey: "agora" | "proximo" | "depois",
  title: string,
  icon: string,
  tasks: Task[],
  rowHeight: number,
  onRefresh: () => void
): Gtk.Widget {
  const activeTasks = tasks.filter((t) => !t.done)
  const isAgora = sectionKey === "agora"
  const countBadgeText = isAgora ? `${activeTasks.length}/${WIP_LIMIT}` : `${activeTasks.length}`

  // 1. Cabeçalho Padronizado e com Altura Fixa Alinhada (Sem botão de editar desestabilizando)
  const iconLabel = new Gtk.Label({
    label: icon,
    valign: Gtk.Align.CENTER,
    cssClasses: ["col-head-icon", `col-head-icon-${sectionKey}`],
  })

  const titleLabel = new Gtk.Label({
    label: title,
    valign: Gtk.Align.CENTER,
    cssClasses: ["col-head-title", `col-head-title-${sectionKey}`],
    halign: Gtk.Align.START,
    hexpand: true,
  })

  const countBadge = new Gtk.Label({
    label: countBadgeText,
    valign: Gtk.Align.CENTER,
    cssClasses: ["col-head-badge", `col-head-badge-${sectionKey}`],
  })

  const headerBox = (
    <box
      orientation={H}
      spacing={8}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.CENTER}
      hexpand={true}
      heightRequest={26}
      class={`col-header col-header-${sectionKey}`}
    >
      {iconLabel}
      {titleLabel}
      {countBadge}
    </box>
  ) as Gtk.Widget

  // 2. Lista de Cards
  const tasksBox = new Gtk.Box({
    orientation: V,
    spacing: 6,
    hexpand: true,
    vexpand: true,
    halign: Gtk.Align.FILL,
    cssClasses: ["col-tasks-box"],
  })

  if (activeTasks.length === 0) {
    const emptyIcon = new Gtk.Label({
      label: "󰄵",
      cssClasses: ["col-empty-icon"],
    })
    const emptyTitle = new Gtk.Label({
      label: "Sem pendências",
      cssClasses: ["col-empty-title"],
    })
    const emptySub = new Gtk.Label({
      label: "Arraste uma tarefa aqui",
      cssClasses: ["col-empty-sub"],
    })
    const emptyBox = (
      <box
        orientation={V}
        spacing={4}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        hexpand={true}
        vexpand={true}
        class="col-empty-box"
      >
        {emptyIcon}
        {emptyTitle}
        {emptySub}
      </box>
    ) as Gtk.Widget
    tasksBox.append(emptyBox)
  } else {
    activeTasks.forEach((task, idx) => {
      tasksBox.append(TaskCard(task, sectionKey, idx, onRefresh))
    })
  }

  // 3. Scrolled Window
  const maxScrollHeight = Math.max(80, rowHeight - 65)
  const scrolled = new Gtk.ScrolledWindow()
  scrolled.set_hexpand(true)
  scrolled.set_vexpand(true)
  scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  scrolled.set_kinetic_scrolling(false)
  scrolled.set_focus_on_click(false)
  scrolled.set_overlay_scrolling(true)
  scrolled.set_propagate_natural_height(false)
  scrolled.set_propagate_natural_width(false)
  scrolled.set_min_content_height(40)
  scrolled.set_max_content_height(maxScrollHeight)
  scrolled.add_css_class("col-scrolled")
  scrolled.set_child(tasksBox)

  // 4. Container da Seção
  const colSection = (
    <box
      orientation={V}
      spacing={8}
      hexpand={true}
      vexpand={true}
      halign={Gtk.Align.FILL}
      class={`prio-section-col prio-section-${sectionKey}`}
    >
      {headerBox}
      <box class={`col-divider col-divider-${sectionKey}`} heightRequest={1} />
      {scrolled}
    </box>
  ) as Gtk.Widget

  colSection.set_overflow(Gtk.Overflow.HIDDEN)

  // Drop Target da coluna inteira
  const dropTarget = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE)
  dropTarget.connect("enter", () => {
    colSection.add_css_class("prio-col-drop-active")
    return Gdk.DragAction.MOVE
  })
  dropTarget.connect("leave", () => {
    colSection.remove_css_class("prio-col-drop-active")
  })
  dropTarget.connect("drop", (_target, value: string) => {
    colSection.remove_css_class("prio-col-drop-active")
    try {
      const data = JSON.parse(value)
      if (data && data.rawText) {
        moveTaskToFile(PRIORIDADES_FILE, data.rawText, sectionKey, undefined)
        onRefresh()
        return true
      }
    } catch (e) {
      console.error("Erro ao receber drop na seção:", e)
    }
    return false
  })
  colSection.add_controller(dropTarget)

  return colSection
}

// ─── Componente: Quadro de Tarefas (Sem Header Redundante) ───────────────────

function UnifiedPriorityBoard(rowHeight: number): Gtk.Widget {
  const agoraWrap = new Gtk.Box({ orientation: V, hexpand: true, vexpand: true, halign: Gtk.Align.FILL })
  const proximoWrap = new Gtk.Box({ orientation: V, hexpand: true, vexpand: true, halign: Gtk.Align.FILL })
  const depoisWrap = new Gtk.Box({ orientation: V, hexpand: true, vexpand: true, halign: Gtk.Align.FILL })

  function clearBox(box: Gtk.Box) {
    let child = box.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      box.remove(child)
      child = next
    }
  }

  let lastRawContent = ""

  function refresh(force = false) {
    const raw = readFile(PRIORIDADES_FILE)
    if (!force && raw === lastRawContent) return
    lastRawContent = raw

    clearBox(agoraWrap)
    clearBox(proximoWrap)
    clearBox(depoisWrap)

    const data = parsePrioridades(raw)

    agoraWrap.append(ColumnSection("agora", "AGORA", "󰀦", data.agora, rowHeight, () => refresh(true)))
    proximoWrap.append(ColumnSection("proximo", "PRÓXIMO", "󰅐", data.proximo, rowHeight, () => refresh(true)))
    depoisWrap.append(ColumnSection("depois", "BACKLOG", "󰒊", data.depois, rowHeight, () => refresh(true)))
  }

  refresh(true)

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => {
    refresh(false)
    return GLib.SOURCE_CONTINUE
  })

  // Colunas delimitadas por barra vertical nítida de 1px (Começa direto nas 3 colunas!)
  const sectionsBox = (
    <box
      orientation={H}
      spacing={0}
      hexpand={true}
      vexpand={true}
      homogeneous={false}
      halign={Gtk.Align.FILL}
      class="prio-board-sections"
    >
      {agoraWrap}
      <box class="prio-section-vsep" widthRequest={1} hexpand={false} />
      {proximoWrap}
      <box class="prio-section-vsep" widthRequest={1} hexpand={false} />
      {depoisWrap}
    </box>
  ) as Gtk.Widget

  const boardZone = (
    <box
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      heightRequest={rowHeight}
      class="dash-top-tasks"
    >
      {sectionsBox}
    </box>
  ) as Gtk.Widget

  boardZone.set_overflow(Gtk.Overflow.HIDDEN)

  return boardZone
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: Faixa de Streaks de Hábitos no Topo (Horizontal, Toda a Largura)
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
  const habitsBox = new Gtk.Box({
    orientation: H,
    spacing: 8,
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
        .map((done) => (done ? `<span foreground="#4ade80">●</span>` : `<span foreground="#64748b">○</span>`))
        .join(" ")

      const streakText =
        h.streak > 0
          ? `<span foreground="#fb923c" weight="heavy">🔥 ${h.streak}d</span>`
          : `<span foreground="#94a3b8" weight="bold">0d</span>`

      const todayBadge = h.doneToday
        ? `<span foreground="#4ade80" weight="bold">✓ Feito</span>`
        : `<span foreground="#f87171" weight="bold">○ Pendente</span>`

      // Linha 1: [Ícone Nome] ... [Streak (Max)]
      const row1 = (
        <box orientation={H} spacing={6} halign={Gtk.Align.FILL} hexpand={true}>
          <label
            useMarkup={true}
            halign={Gtk.Align.START}
            xalign={0}
            label={`<span size="12000">${h.icon}</span>  <span foreground="#ffffff" weight="bold" size="10500">${h.name}</span>`}
          />
          <box hexpand={true} />
          <label
            useMarkup={true}
            halign={Gtk.Align.END}
            xalign={1}
            label={`<span size="10000">${streakText}</span> <span size="8500" foreground="#64748b">(${h.maxStreak}d)</span>`}
          />
        </box>
      ) as Gtk.Widget

      // Linha 2: [Histórico ● ● ●] ... [Badge Status]
      const row2 = (
        <box orientation={H} spacing={6} halign={Gtk.Align.FILL} hexpand={true}>
          <label
            useMarkup={true}
            halign={Gtk.Align.START}
            xalign={0}
            label={`<span size="10000">${dots}</span>`}
          />
          <box hexpand={true} />
          <label
            useMarkup={true}
            halign={Gtk.Align.END}
            xalign={1}
            label={`<span size="9500">${todayBadge}</span>`}
          />
        </box>
      ) as Gtk.Widget

      const card = (
        <box
          class={`habit-mini-card ${h.doneToday ? "habit-done" : ""}`}
          orientation={V}
          spacing={4}
          hexpand={true}
          vexpand={true}
          halign={Gtk.Align.FILL}
          valign={Gtk.Align.FILL}
        >
          {row1}
          {row2}
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
      class="dash-inner-panel habits-top-panel"
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
  gesture.connect("pressed", () => {
    openHabitsModal("today")
  })
  panel.add_controller(gesture)

  return panel
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: Gráfico de Linhas de Horas de Estudo por Semana (registros.csv)
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

function getWeekInfoFromDate(date: Date): { key: string; label: string; monday: Date } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`

  const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`
  const label = `${fmt(monday)} - ${fmt(sunday)}`
  return { key, label, monday }
}

function getWeekInfo(dateStr: string): { key: string; label: string; monday: Date } | null {
  const parts = dateStr.trim().split("-")
  if (parts.length !== 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null

  return getWeekInfoFromDate(new Date(y, m, d))
}

function readStudyWeeks(): WeekData[] {
  try {
    const raw = readFile(`${VITTAE_DIR}/registros.csv`)
    if (!raw) return []
    const lines = raw.split("\n")
    const weekMap = new Map<string, number>()
    let earliestMonday: Date | null = null

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
      const currentHours = weekMap.get(info.key) || 0
      weekMap.set(info.key, currentHours + hours)

      if (!earliestMonday || info.monday.getTime() < earliestMonday.getTime()) {
        earliestMonday = info.monday
      }
    }

    if (!earliestMonday) return []

    const currentWeekInfo = getWeekInfoFromDate(new Date())
    const currentMonday = currentWeekInfo.monday
    const endMonday = currentMonday.getTime() > earliestMonday.getTime() ? currentMonday : earliestMonday

    const result: WeekData[] = []
    const cur = new Date(earliestMonday)

    while (cur.getTime() <= endMonday.getTime()) {
      const info = getWeekInfoFromDate(cur)
      const hours = weekMap.get(info.key) || 0
      result.push({
        key: info.key,
        label: info.label,
        hours: Math.round(hours * 10) / 10,
        monday: new Date(info.monday),
      })
      cur.setDate(cur.getDate() + 7)
    }

    return result
  } catch (e) {
    console.error("Erro ao ler registros.csv:", e)
    return []
  }
}

function drawStudyChart(cr: cairo.Context, width: number, height: number, data: WeekData[]) {
  cr.save()

  const padLeft = 32
  const padRight = 20
  const padTop = 28
  const padBottom = 26
  const plotW = Math.max(10, width - padLeft - padRight)
  const plotH = Math.max(10, height - padTop - padBottom)

  const validData = data.filter((d) => d.hours > 0)
  const totalHours = validData.reduce((acc, d) => acc + d.hours, 0)
  const avgHours = data.length > 0 ? (totalHours / data.length).toFixed(1) : "0"
  const bestHours = validData.length > 0 ? Math.max(...validData.map((d) => d.hours)).toFixed(1) : "0"
  const summaryText = `Ideal: 40h/sem  •  Média: ${avgHours}h/sem  •  Melhor: ${bestHours}h`

  cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
  cr.setFontSize(11)
  const sumExt = cr.textExtents(summaryText)
  const badgeX = width - padRight - sumExt.width - 12
  const badgeY = 6
  cr.setSourceRGBA(0.08, 0.10, 0.15, 0.85)
  cr.rectangle(badgeX, badgeY, sumExt.width + 12, 20)
  cr.fill()
  cr.setSourceRGBA(0.063, 0.725, 0.506, 0.30)
  cr.setLineWidth(1)
  cr.rectangle(badgeX, badgeY, sumExt.width + 12, 20)
  cr.stroke()
  cr.setSourceRGBA(0.90, 0.93, 0.96, 0.95)
  cr.moveTo(badgeX + 6, badgeY + 14)
  cr.showText(summaryText)

  if (data.length === 0) {
    cr.setSourceRGBA(0.6, 0.65, 0.75, 0.6)
    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
    cr.setFontSize(12)
    cr.moveTo(width / 2 - 60, height / 2)
    cr.showText("Sem dados em registros.csv")
    cr.restore()
    return
  }

  const maxVal = Math.max(...data.map((d) => d.hours), 10)
  const step = maxVal > 30 ? 10 : 5
  const yMax = Math.ceil((maxVal * 1.2) / step) * step
  const gridSteps = Math.min(5, Math.floor(yMax / step))

  cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
  cr.setFontSize(10)
  for (let s = 0; s <= gridSteps; s++) {
    const val = s * (yMax / gridSteps)
    const y = padTop + plotH - (val / yMax) * plotH

    cr.setSourceRGBA(1.0, 1.0, 1.0, s === 0 ? 0.10 : 0.04)
    cr.setLineWidth(1)
    cr.newPath()
    cr.moveTo(padLeft, y)
    cr.lineTo(padLeft + plotW, y)
    cr.stroke()

    cr.setSourceRGBA(0.55, 0.62, 0.72, 0.75)
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

    cr.setSourceRGBA(0.063, 0.725, 0.506, 0.14)
    cr.fill()
  }

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
  cr.setSourceRGBA(0.063, 0.725, 0.506, 0.95)
  cr.setLineWidth(2.4)
  cr.stroke()

  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    cr.setSourceRGBA(0.063, 0.725, 0.506, 0.20)
    cr.arc(p.x, p.y, 5.5, 0, 2 * Math.PI)
    cr.fill()

    cr.setSourceRGBA(0.063, 0.725, 0.506, 1.0)
    cr.arc(p.x, p.y, 3.0, 0, 2 * Math.PI)
    cr.fill()

    cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0)
    cr.arc(p.x, p.y, 1.2, 0, 2 * Math.PI)
    cr.fill()

    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
    cr.setFontSize(11)
    cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95)
    const valText = `${p.val}h`
    const valExt = cr.textExtents(valText)
    cr.moveTo(p.x - valExt.width / 2, Math.max(14, p.y - 7))
    cr.showText(valText)

    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
    cr.setFontSize(10)
    cr.setSourceRGBA(0.65, 0.72, 0.82, 0.80)
    const lblExt = cr.textExtents(p.label)
    cr.moveTo(p.x - lblExt.width / 2, padTop + plotH + 16)
    cr.showText(p.label)
  }

  cr.restore()
}

function StudyHoursChart(cardHeight: number, cardWidth = 949): Gtk.Widget {
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

  const panel = (
    <box
      class="dash-inner-panel chart-panel"
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      widthRequest={cardWidth}
      heightRequest={cardHeight}
    >
      <box class="chart-container" hexpand={true} vexpand={true}>
        {drawingArea}
      </box>
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
// COMPONENTE: Tabela Viva do Cronograma (cronograma.csv) + Notificações
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

function LiveScheduleTable(rowHeight = 529, colWidth = 949): Gtk.Widget {
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

    checkScheduleNotification(rows, currentDayIdx, activeRowIdx)

    let child = grid.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      grid.remove(child)
      child = next
    }

    const timeColHead = new Gtk.Label({
      label: "Hora",
      cssClasses: ["sched-col-header", "time-col"],
      halign: Gtk.Align.CENTER,
      xalign: 0.5,
      hexpand: false,
      widthRequest: 50,
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

    rows.forEach((row, rIdx) => {
      const gridRow = rIdx + 1

      const compactTime = `${row.startHour}h-${row.endHour}h`
      const timeLabel = new Gtk.Label({
        label: compactTime,
        cssClasses: ["sched-time-cell"],
        halign: Gtk.Align.CENTER,
        xalign: 0.5,
        hexpand: false,
        widthRequest: 46,
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

  const panel = (
    <box
      class="dash-inner-panel sched-panel"
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      widthRequest={colWidth || 1140}
      heightRequest={rowHeight}
    >
      <box class="sched-table-wrapper" orientation={V} hexpand={true} vexpand={true}>
        {grid}
      </box>
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
// JANELA PRINCIPAL TODOCARDS (HÁBITOS NO TOPO + TAREFAS + GRÁFICO E CRONOGRAMA)
// ─────────────────────────────────────────────────────────────────────────────

export function TodoCards(monitor = 0): Astal.Window {
  const { topHeight, bottomHeight } = getDashboardHeights(monitor) // top: 477px, bottom: 582px (+10% para gráfico/tabela)
  const totalWidth = getDisplayWidth(monitor) // 1899px
  const halfWidth = Math.floor((totalWidth - 1) / 2) // 50% = 949px

  const habitsStripHeight = 68
  const tasksHeight = topHeight - habitsStripHeight - 1 // 408px

  // 1. Faixa Superior: Hábitos em toda a largura horizontal no topo
  const topHabitsStrip = HabitsStreakPanel(habitsStripHeight)

  // 2. Divisor nítido de 1px entre Hábitos e Tarefas
  const topDivider = <box class="prio-board-divider" heightRequest={1} hexpand={true} />

  // 3. Quadro de Tarefas (3 Colunas direto, sem o header antigo)
  const tasksZone = UnifiedPriorityBoard(tasksHeight)

  // 4. Bloco Superior Completo (Hábitos no topo + divisor + Tarefas)
  const topHalf = (
    <box
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      heightRequest={topHeight}
      class="dash-top-half"
    >
      {topHabitsStrip}
      {topDivider}
      {tasksZone}
    </box>
  ) as Gtk.Widget

  // 5. Linha Divisora Horizontal Central (1px nítida)
  const midDivider = <box class="prio-zone-hsep" heightRequest={1} hexpand={true} />

  // 6. Bloco Inferior (50% Gráfico de Horas na esquerda, 50% Cronograma na direita com +10% de altura)
  const bottomHalf = (
    <box
      orientation={H}
      spacing={0}
      hexpand={true}
      vexpand={true}
      homogeneous={false}
      halign={Gtk.Align.FILL}
      heightRequest={bottomHeight}
      class="dash-bottom-zone"
    >
      {StudyHoursChart(bottomHeight, halfWidth)}
      <box class="prio-section-vsep" widthRequest={1} hexpand={false} />
      {LiveScheduleTable(bottomHeight, halfWidth)}
    </box>
  ) as Gtk.Widget

  // 7. Box Geral Única Contínua
  const unifiedBox = (
    <box
      orientation={V}
      spacing={0}
      hexpand={true}
      vexpand={true}
      class="unified-dashboard-container"
    >
      {topHalf}
      {midDivider}
      {bottomHalf}
    </box>
  ) as Gtk.Widget

  unifiedBox.set_overflow(Gtk.Overflow.HIDDEN)

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
      marginTop={10}
      marginLeft={10}
      marginRight={10}
      marginBottom={10}
    >
      {unifiedBox}
    </window>
  ) as Astal.Window
}

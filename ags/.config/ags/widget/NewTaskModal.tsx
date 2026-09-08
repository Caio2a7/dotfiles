import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
const H = Gtk.Orientation.HORIZONTAL
const V = Gtk.Orientation.VERTICAL

const VITTAE_DIR = `${GLib.get_home_dir()}/vittae`
const PRIORIDADES_FILE = `${VITTAE_DIR}/tarefas/prioridades.md`

interface DomainOption {
  key: string
  name: string
  icon: string
  color: string
}

const DOMAIN_OPTIONS: DomainOption[] = [
  { key: "faculdade", name: "Faculdade", icon: "󰑴", color: "#db2777" },
  { key: "estudos", name: "Estudos", icon: "󱚌", color: "#34d399" },
  { key: "dell", name: "Dell", icon: "󰃖", color: "#c48350" },
  { key: "pathotech", name: "Pathotech", icon: "󰃖", color: "#c48350" },
  { key: "sti", name: "STI", icon: "󰃖", color: "#c48350" },
  { key: "vida", name: "Vida", icon: "󰖙", color: "#ffffff" },
]

interface PriorityOption {
  key: "agora" | "proximo" | "depois"
  name: string
  sub: string
  icon: string
  color: string
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  { key: "agora", name: "AGORA", sub: "P1", icon: "󰀦", color: "#f43f5e" },
  { key: "proximo", name: "PRÓXIMO", sub: "P2", icon: "󰅐", color: "#f59e0b" },
  { key: "depois", name: "BACKLOG", sub: "P3", icon: "󰒊", color: "#94a3b8" },
]

let modalWindowInstance: Astal.Window | null = null
let focusEntryCallback: (() => void) | null = null

export function openNewTaskModal(): void {
  if (modalWindowInstance) {
    modalWindowInstance.visible = true
    if (focusEntryCallback) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        focusEntryCallback?.()
        return GLib.SOURCE_REMOVE
      })
    }
  }
}

export function closeNewTaskModal(): void {
  if (modalWindowInstance) {
    modalWindowInstance.visible = false
  }
}

export function toggleNewTaskModal(): void {
  if (modalWindowInstance) {
    if (modalWindowInstance.visible) {
      closeNewTaskModal()
    } else {
      openNewTaskModal()
    }
  }
}

function insertTaskIntoFile(
  filePath: string,
  domainName: string,
  taskText: string,
  priorityKey: "agora" | "proximo" | "depois"
): boolean {
  try {
    const [ok, bytes] = GLib.file_get_contents(filePath)
    if (!ok) return false
    const content = new TextDecoder().decode(bytes)
    const lines = content.split("\n")

    const sectionMarkers: Record<string, string> = {
      agora: "[!CAUTION]",
      proximo: "[!WARNING]",
      depois: "[!IMPORTANT]",
    }
    const targetMarker = sectionMarkers[priorityKey]
    if (!targetMarker) return false

    const formattedTask = `> - [ ] [${domainName}] ${taskText.trim()}`
    const finalLines: string[] = []
    let inserted = false

    for (const line of lines) {
      finalLines.push(line)
      if (line.includes(targetMarker) && !inserted) {
        finalLines.push(formattedTask)
        inserted = true
      }
    }

    if (!inserted) {
      finalLines.push(formattedTask)
    }

    GLib.file_set_contents(filePath, finalLines.join("\n"))

    // Notificação visual de sucesso
    try {
      Gio.Subprocess.new(
        [
          "notify-send",
          "-a",
          "Prioridades",
          "-i",
          "checkbox",
          "Nova Tarefa Criada",
          `[${domainName}] ${taskText} (${priorityKey.toUpperCase()})`,
        ],
        Gio.SubprocessFlags.NONE
      )
    } catch (_) {}

    return true
  } catch (e) {
    console.error("Erro ao salvar nova tarefa:", e)
    return false
  }
}

export function NewTaskModal(monitor = 0): Astal.Window {
  let selectedDomain = DOMAIN_OPTIONS[0]
  let selectedPriority = PRIORITY_OPTIONS[1] // Padrão: PRÓXIMO (P2)

  // 1. Campo de Entrada de Texto
  const entry = new Gtk.Entry({
    placeholderText: "O que precisa ser feito?",
    hexpand: true,
    cssClasses: ["new-task-entry"],
  })

  focusEntryCallback = () => {
    entry.grab_focus()
  }

  // 2. Seletores de Domínio
  const domainButtonsBox = new Gtk.Box({
    orientation: H,
    spacing: 6,
    hexpand: true,
    halign: Gtk.Align.FILL,
  })

  const domainBtns: { opt: DomainOption; btn: Gtk.Button }[] = []

  function updateDomainButtons() {
    domainBtns.forEach(({ opt, btn }) => {
      if (opt.key === selectedDomain.key) {
        btn.set_css_classes(["new-task-domain-btn", "active"])
      } else {
        btn.set_css_classes(["new-task-domain-btn"])
      }
    })
  }

  DOMAIN_OPTIONS.forEach((opt) => {
    const btnLabel = new Gtk.Label({
      useMarkup: true,
      label: `<span foreground="${opt.color}" size="9500">${opt.icon}</span>  <span foreground="#94a3b8" size="9000">${opt.name}</span>`,
    })
    const btn = new Gtk.Button({
      child: btnLabel,
      hexpand: true,
      cssClasses: ["new-task-domain-btn"],
    })
    btn.connect("clicked", () => {
      selectedDomain = opt
      updateDomainButtons()
      entry.grab_focus()
    })
    domainBtns.push({ opt, btn })
    domainButtonsBox.append(btn)
  })

  updateDomainButtons()

  // 3. Seletores de Prioridade
  const priorityButtonsBox = new Gtk.Box({
    orientation: H,
    spacing: 8,
    hexpand: true,
    halign: Gtk.Align.FILL,
  })

  const priorityBtns: { opt: PriorityOption; btn: Gtk.Button }[] = []

  function updatePriorityButtons() {
    priorityBtns.forEach(({ opt, btn }) => {
      if (opt.key === selectedPriority.key) {
        btn.set_css_classes(["new-task-prio-btn", `prio-${opt.key}`, "active"])
      } else {
        btn.set_css_classes(["new-task-prio-btn", `prio-${opt.key}`])
      }
    })
  }

  PRIORITY_OPTIONS.forEach((opt) => {
    const btnLabel = new Gtk.Label({
      useMarkup: true,
      label: `<span size="9500" weight="bold">${opt.icon}  ${opt.name}</span> <span size="8000">(${opt.sub})</span>`,
    })
    const btn = new Gtk.Button({
      child: btnLabel,
      hexpand: true,
      cssClasses: ["new-task-prio-btn", `prio-${opt.key}`],
    })
    btn.connect("clicked", () => {
      selectedPriority = opt
      updatePriorityButtons()
      entry.grab_focus()
    })
    priorityBtns.push({ opt, btn })
    priorityButtonsBox.append(btn)
  })

  updatePriorityButtons()

  // 4. Ação de Submissão
  function handleSubmit() {
    const text = entry.get_text().trim()
    if (!text) return

    insertTaskIntoFile(PRIORIDADES_FILE, selectedDomain.name, text, selectedPriority.key)
    entry.set_text("")
    closeNewTaskModal()
  }

  entry.connect("activate", () => {
    handleSubmit()
  })

  // 5. Cabeçalho do Modal
  const headerBox = (
    <box orientation={H} spacing={10} halign={Gtk.Align.FILL} hexpand={true} class="new-task-header">
      <label label="󰄱" class="new-task-header-icon" />
      <box orientation={V} hexpand={true} valign={Gtk.Align.CENTER}>
        <label label="Nova Tarefa" class="new-task-header-title" halign={Gtk.Align.START} />
        <label label="Adicionar ao fluxo de prioridades" class="new-task-header-sub" halign={Gtk.Align.START} />
      </box>
      <box class="new-task-esc-badge" valign={Gtk.Align.CENTER}>
        <label label="Esc" class="new-task-esc-label" />
      </box>
    </box>
  ) as Gtk.Widget

  // 6. Rodapé com Botões
  const cancelBtn = new Gtk.Button({
    child: new Gtk.Label({ label: "Cancelar (Esc)" }),
    cssClasses: ["new-task-btn-cancel"],
  })
  cancelBtn.connect("clicked", () => {
    closeNewTaskModal()
  })

  const submitBtn = new Gtk.Button({
    child: new Gtk.Label({ label: "󰐱  Criar Tarefa (Enter)", cssClasses: ["new-task-btn-submit-label"] }),
    hexpand: true,
    cssClasses: ["new-task-btn-submit"],
  })
  submitBtn.connect("clicked", () => {
    handleSubmit()
  })

  const footerBox = (
    <box orientation={H} spacing={10} halign={Gtk.Align.FILL} hexpand={true} class="new-task-footer">
      {cancelBtn}
      {submitBtn}
    </box>
  ) as Gtk.Widget

  // 7. Corpo do Diálogo
  const dialogCard = (
    <box
      orientation={V}
      spacing={14}
      class="new-task-dialog"
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    >
      {headerBox}
      <box class="new-task-divider" heightRequest={1} />

      {/* Campo de texto */}
      <box orientation={V} spacing={4}>
        <label label="TÍTULO DA TAREFA" class="new-task-field-label" halign={Gtk.Align.START} />
        {entry}
      </box>

      {/* Seleção de Domínio */}
      <box orientation={V} spacing={6}>
        <label label="TIPO DE TAREFA (CATEGORIA)" class="new-task-field-label" halign={Gtk.Align.START} />
        {domainButtonsBox}
      </box>

      {/* Seleção de Prioridade */}
      <box orientation={V} spacing={6}>
        <label label="PRIORIDADE DE EXECUÇÃO" class="new-task-field-label" halign={Gtk.Align.START} />
        {priorityButtonsBox}
      </box>

      <box class="new-task-divider" heightRequest={1} />
      {footerBox}
    </box>
  ) as Gtk.Widget

  const scrim = (
    <box
      class="new-task-scrim"
      hexpand={true}
      vexpand={true}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
    >
      {dialogCard}
    </box>
  ) as Gtk.Widget

  // Fechar ao clicar no scrim (fora do card)
  const scrimClick = new Gtk.GestureClick()
  scrimClick.set_button(1)
  scrimClick.connect("pressed", (_g, _n, x, y) => {
    // Se o clique foi fora do diálogo central, fecha
    const alloc = dialogCard.get_allocation()
    if (x < alloc.x || x > alloc.x + alloc.width || y < alloc.y || y > alloc.y + alloc.height) {
      closeNewTaskModal()
    }
  })
  scrim.add_controller(scrimClick)

  const win = (
    <window
      name="new-task-modal"
      class="NewTaskModal"
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
      closeNewTaskModal()
      return true
    }
    return false
  })
  win.add_controller(keyController)

  modalWindowInstance = win
  return win
}

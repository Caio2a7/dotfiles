import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createBinding, createComputed } from "ags"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Network from "gi://AstalNetwork"
import GLib from "gi://GLib"
import GObject from "gi://GObject"
import WirePlumber from "gi://AstalWp"
import cairo from "gi://cairo"
import { openAppPickerModal } from "./AppPickerModal"
import { WorkspacesSection, AudioControlsSection, StatusSection } from "./WorkStatus"
import { StudySection } from "./StudySection"
import { DockApp, removeDockApp, reorderDockApps, subscribeDockApps } from "./dockStore"
import { windowsFor, isFocusedApp, focusOrCycle } from "./dockWindows"

function renderAppIcon(icon: string): Gtk.Widget {
  if (icon.startsWith("/") || icon.endsWith(".png") || icon.endsWith(".svg")) {
    const img = Gtk.Image.new_from_file(icon)
    // img.set_pixel_size(32)
    img.set_pixel_size(28)
    img.halign = Gtk.Align.CENTER
    img.valign = Gtk.Align.CENTER
    img.add_css_class("dock-app-icon")
    return img
  }
  const img = new Gtk.Image({
    iconName: icon || "application-x-executable",
    // pixelSize: 32,
    pixelSize: 28,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
  })
  img.add_css_class("dock-app-icon")
  return img
}

const allPopovers: Gtk.Popover[] = []
let dockPillWidget: Gtk.Widget | null = null
let isDraggingApp = false
let onDockInteractionFinished: (() => void) | null = null

// Idempotente: drop + drag-end disparam em sequência
function endAppDrag(): void {
  if (!isDraggingApp) return
  isDraggingApp = false
  onDockInteractionFinished?.()
}

function setDockMenuActive(active: boolean) {
  if (dockPillWidget) {
    if (active) {
      dockPillWidget.add_css_class("menu-active")
    } else {
      dockPillWidget.remove_css_class("menu-active")
    }
  }
}

function isAnyPopoverOpen(): boolean {
  return allPopovers.some((p) => p.get_visible())
}

// Após fechar o menu, reavalia o auto-hide fora do handler de "closed" (evita reentrância)
function handlePopoverClosed(): void {
  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
    if (!isAnyPopoverOpen()) {
      setDockMenuActive(false)
      onDockInteractionFinished?.()
    }
    return GLib.SOURCE_REMOVE
  })
}

// Abre um único menu: fecha os demais e reivindica o clique para não propagar ao fundo do dock
function openContextMenu(gesture: Gtk.GestureClick, popover: Gtk.Popover): void {
  gesture.set_state(Gtk.EventSequenceState.CLAIMED)
  for (const p of allPopovers) {
    if (p !== popover && p.get_visible()) p.popdown()
  }
  popover.popup()
}

function createAppContextMenu(appItem: DockApp, parent: Gtk.Widget): Gtk.Popover {
  const menuBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    cssClasses: ["dock-menu-box"],
  })

  const removeBtn = new Gtk.Button({
    cssClasses: ["dock-menu-btn", "danger"],
    child: new Gtk.Label({ label: "󰅖  Remover do Dock", xalign: 0 }),
  })
  const addBtn = new Gtk.Button({
    cssClasses: ["dock-menu-btn"],
    child: new Gtk.Label({ label: "󰐕  Adicionar Aplicativo...", xalign: 0 }),
  })

  const popover = new Gtk.Popover({ hasArrow: true, autohide: true, child: menuBox })
  popover.set_parent(parent)
  // anterior: BOTTOM (original), BOTTOM (dock no topo)
  popover.set_position(Gtk.PositionType.LEFT) // dock na direita: menu abre para a esquerda
  allPopovers.push(popover)

  popover.connect("show", () => {
    setDockMenuActive(true)
  })
  popover.connect("closed", handlePopoverClosed)

  removeBtn.connect("clicked", () => {
    popover.popdown()
    removeDockApp(appItem.id)
  })
  addBtn.connect("clicked", () => {
    popover.popdown()
    openAppPickerModal()
  })

  menuBox.append(removeBtn)
  menuBox.append(addBtn)
  return popover
}

function setupAppItemDnd(itemBox: Gtk.Widget, getIndex: () => number): void {
  const dragSource = new Gtk.DragSource()
  dragSource.set_actions(Gdk.DragAction.MOVE)
  const paintable = new Gtk.WidgetPaintable({ widget: itemBox })

  dragSource.connect("prepare", (_s, x, y) => {
    dragSource.set_icon(paintable, Math.floor(x), Math.floor(y))
    return Gdk.ContentProvider.new_for_value(String(getIndex()))
  })
  dragSource.connect("drag-begin", () => {
    isDraggingApp = true
    itemBox.remove_css_class("hovered")
  })
  dragSource.connect("drag-end", () => {
    endAppDrag()
  })
  dragSource.connect("drag-cancel", () => {
    endAppDrag()
    return false
  })
  itemBox.add_controller(dragSource)

  const dropTarget = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE)
  dropTarget.connect("enter", () => {
    itemBox.add_css_class("dock-drop-hover")
    return Gdk.DragAction.MOVE
  })
  dropTarget.connect("leave", () => {
    itemBox.remove_css_class("dock-drop-hover")
  })
  dropTarget.connect("drop", (_target, value: string) => {
    itemBox.remove_css_class("dock-drop-hover")
    endAppDrag()
    const fromIdx = parseInt(value, 10)
    const targetIdx = getIndex()
    if (!isNaN(fromIdx) && fromIdx !== targetIdx && targetIdx >= 0) {
      reorderDockApps(fromIdx, targetIdx)
      return true
    }
    return false
  })
  itemBox.add_controller(dropTarget)
}

function AppItem({
  appItem,
  getIndex,
  hypr,
}: {
  appItem: DockApp
  getIndex: () => number
  hypr: Hyprland.Hyprland
}) {
  // anterior: matcher por regex (class/initial_class/title) + ponto único "active"
  const launch = () => GLib.spawn_command_line_async(appItem.cmd)
  const dots = [0, 1, 2].map(() => new Gtk.Box({ cssClasses: ["dock-app-dot"] }))

  const btn = (
    <button
      class={`dock-app-item ${appItem.className}`}
      tooltipText={appItem.name}
      // onClicked={() => GLib.spawn_command_line_async(appItem.cmd)}
      onClicked={() => {
        if (!focusOrCycle(appItem, hypr)) launch()
      }}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    >
      {/* <box orientation={Gtk.Orientation.VERTICAL} spacing={3} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}> */}
      <box orientation={Gtk.Orientation.VERTICAL} spacing={1} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        {renderAppIcon(appItem.icon)}
        {/* <box class={createComputed(() => (isOpen() ? "dock-app-dot active" : "dock-app-dot"))} halign={Gtk.Align.CENTER} /> */}
        <box class="dock-app-dots" spacing={3} halign={Gtk.Align.CENTER}>
          {dots}
        </box>
      </box>
    </button>
  ) as Gtk.Widget

  // Hover gerenciado explicitamente para reset limpo no clique direito
  const hoverMotion = new Gtk.EventControllerMotion()
  hoverMotion.connect("enter", () => {
    if (!dockPillWidget?.has_css_class("menu-active")) {
      btn.add_css_class("hovered")
    }
  })
  hoverMotion.connect("leave", () => {
    btn.remove_css_class("hovered")
  })
  btn.add_controller(hoverMotion)

  // Atualiza pontos (1–3 = nº de janelas) e destaque de foco a cada mudança do Hyprland
  const updateWindows = () => {
    const wins = windowsFor(appItem, hypr.clients ?? [])
    dots.forEach((d, i) => {
      d.set_visible(i < wins.length)
      d.add_css_class("active")
    })
    if (isFocusedApp(wins, hypr.focusedClient ?? null)) btn.add_css_class("focused")
    else btn.remove_css_class("focused")
  }
  const hyprIds = [hypr.connect("notify::clients", updateWindows), hypr.connect("notify::focused-client", updateWindows)]
  btn.connect("destroy", () => hyprIds.forEach((id) => hypr.disconnect(id)))
  updateWindows()

  // Clique do meio: sempre abre nova instância
  const middleClick = new Gtk.GestureClick()
  middleClick.set_button(2)
  middleClick.connect("pressed", (gesture) => {
    gesture.set_state(Gtk.EventSequenceState.CLAIMED)
    launch()
  })
  btn.add_controller(middleClick)

  const popover = createAppContextMenu(appItem, btn)
  const rightClick = new Gtk.GestureClick()
  rightClick.set_button(3)
  rightClick.connect("pressed", (gesture) => {
    btn.remove_css_class("hovered")
    openContextMenu(gesture, popover)
  })
  btn.add_controller(rightClick)

  setupAppItemDnd(btn, getIndex)
  return btn
}

function AppsSection({ hypr }: { hypr: Hyprland.Hyprland }) {
  const container = new Gtk.Box({
    // orientation: Gtk.Orientation.HORIZONTAL,
    orientation: Gtk.Orientation.VERTICAL,
    // spacing: 6,
    // spacing: 2,
    spacing: 0,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ["dock-apps-section"],
  })

  const widgetMap = new Map<string, Gtk.Widget>()
  let currentApps: DockApp[] = []

  const getAppIndex = (id: string) => {
    return currentApps.findIndex((a) => a.id === id)
  }

  const refresh = (apps: DockApp[]) => {
    currentApps = [...apps]
    const newIdSet = new Set(apps.map((a) => a.id))

    // Remove widgets de apps que foram deletados
    for (const [id, w] of widgetMap.entries()) {
      if (!newIdSet.has(id)) {
        container.remove(w)
        widgetMap.delete(id)
      }
    }

    // Reutiliza widgets existentes sem recriar JSX/bindings (elimina tracking context error)
    let prevWidget: Gtk.Widget | null = null
    for (const app of apps) {
      let w = widgetMap.get(app.id)
      if (!w) {
        w = AppItem({ appItem: app, getIndex: () => getAppIndex(app.id), hypr })
        widgetMap.set(app.id, w)
        container.append(w)
      }
      container.reorder_child_after(w, prevWidget)
      prevWidget = w
    }
  }

  subscribeDockApps(refresh)
  return container
}

function DockContainer({
  hypr,
  bat,
  net,
  wp,
}: {
  hypr: Hyprland.Hyprland
  bat: Battery.Battery
  net: Network.Network
  wp: WirePlumber.WirePlumber | null
}) {
  const pillBox = (
    // <box class="liquid-dock-container" spacing={8} halign={Gtk.Align.CENTER} valign={Gtk.Align.END}>
    // <box class="liquid-dock-container" orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
    // <box class="liquid-dock-container" orientation={Gtk.Orientation.VERTICAL} spacing={5} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
    // <box class="liquid-dock-container" orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
    // <box class="liquid-dock-container" orientation={Gtk.Orientation.VERTICAL} spacing={14} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
    <box class="liquid-dock-container" orientation={Gtk.Orientation.VERTICAL} spacing={20} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
      {/* 1. Asa Esquerda: Workspaces + Controles de Áudio (Largura simétrica 220px) */}
      {/* <box class="dock-wing-left" spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} widthRequest={220}> */}
      {/* <box class="dock-wing-left" orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}> */}
      {/* <box class="dock-wing-left" orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}> */}
      {/* <box class="dock-wing-left" orientation={Gtk.Orientation.VERTICAL} spacing={14} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}> */}
      <box class="dock-wing-left" orientation={Gtk.Orientation.VERTICAL} spacing={20} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <WorkspacesSection hypr={hypr} />
        {/* <box class="dock-vsep" widthRequest={1} heightRequest={20} valign={Gtk.Align.CENTER} /> */}
        {/* <box class="dock-vsep" widthRequest={20} heightRequest={1} halign={Gtk.Align.CENTER} /> */}
        <AudioControlsSection wp={wp} />
      </box>

      {/* Divisor Central Esquerdo */}
      {/* <box class="dock-vsep" widthRequest={1} heightRequest={24} valign={Gtk.Align.CENTER} /> */}
      {/* <box class="dock-vsep" widthRequest={24} heightRequest={1} halign={Gtk.Align.CENTER} /> */}

      {/* 2. Centro: Aplicativos (EXATAMENTE NO CENTRO DA TELA) */}
      <AppsSection hypr={hypr} />

      {/* Divisor Central Direito */}
      {/* <box class="dock-vsep" widthRequest={1} heightRequest={24} valign={Gtk.Align.CENTER} /> */}
      {/* <box class="dock-vsep" widthRequest={24} heightRequest={1} halign={Gtk.Align.CENTER} /> */}

      {/* 3. Asa Direita: Wi-Fi + Bateria + Relógio/Data (Largura simétrica 220px) */}
      {/* <box class="dock-wing-right" spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} widthRequest={220}> */}
      {/* <box class="dock-wing-right" orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}> */}
      <box class="dock-wing-right" orientation={Gtk.Orientation.VERTICAL} spacing={20} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <StudySection />
        <StatusSection bat={bat} net={net} />
      </box>
    </box>
  ) as Gtk.Widget

  // Context menu on the dock
  const bgMenuBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, cssClasses: ["dock-menu-box"] })
  const addBtn = new Gtk.Button({
    cssClasses: ["dock-menu-btn"],
    child: new Gtk.Label({ label: "󰐕  Adicionar Aplicativo...", xalign: 0 }),
  })
  const popover = new Gtk.Popover({ hasArrow: true, autohide: true, child: bgMenuBox })
  popover.set_parent(pillBox)
  // anterior: BOTTOM (original), BOTTOM (dock no topo)
  popover.set_position(Gtk.PositionType.LEFT) // dock na direita: menu abre para a esquerda
  allPopovers.push(popover)

  popover.connect("show", () => {
    setDockMenuActive(true)
  })
  popover.connect("closed", handlePopoverClosed)

  addBtn.connect("clicked", () => {
    popover.popdown()
    openAppPickerModal()
  })
  bgMenuBox.append(addBtn)

  const rightClick = new Gtk.GestureClick()
  rightClick.set_button(3)
  rightClick.connect("pressed", (gesture) => openContextMenu(gesture, popover))
  pillBox.add_controller(rightClick)

  dockPillWidget = pillBox

  return pillBox
}

function getSurface(win: Astal.Window): Gdk.Surface | null {
  return (win as unknown as Gtk.Native).get_surface() ?? null
}

const HOT_ZONE_PX = 4

// Oculto: só a faixa inferior da superfície recebe input (hot zone); revelado: superfície inteira
function setHotZoneInput(surface: Gdk.Surface, hotZoneOnly: boolean) {
  if (!hotZoneOnly) {
    surface.set_input_region(null)
    return
  }
  type RegionRect = { x: number; y: number; width: number; height: number }
  const region = new cairo.Region() as cairo.Region & { unionRectangle(rect: RegionRect): void }
  const height = surface.get_height()
  region.unionRectangle({ x: 0, y: Math.max(0, height - HOT_ZONE_PX), width: surface.get_width(), height: HOT_ZONE_PX })
  surface.set_input_region(region)
}

function setupAutoHide(win: Astal.Window, outerBox: Gtk.Widget, revealer: Gtk.Revealer, peekBar: Gtk.Widget) {
  let isRevealed = false
  let leaveTimeoutId: number | null = null
  const motion = new Gtk.EventControllerMotion()

  const applyInputRegion = () => {
    const surface = getSurface(win)
    if (surface) setHotZoneInput(surface, !isRevealed)
  }

  const cancelLeaveTimeout = () => {
    if (leaveTimeoutId !== null) {
      GLib.source_remove(leaveTimeoutId)
      leaveTimeoutId = null
    }
  }

  const showDock = () => {
    cancelLeaveTimeout()
    if (isRevealed) return
    isRevealed = true
    applyInputRegion()
    peekBar.set_visible(false)
    revealer.set_reveal_child(true)
  }

  const hideDock = () => {
    if (!isRevealed || isDraggingApp || isAnyPopoverOpen()) return
    isRevealed = false
    revealer.set_reveal_child(false)
    peekBar.set_visible(true)

    // Após o slide-down (260ms), restringe o input à hot zone inferior
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 260, () => {
      if (!isRevealed) applyInputRegion()
      return GLib.SOURCE_REMOVE
    })
  }

  const scheduleLeaveTimeout = () => {
    cancelLeaveTimeout()
    if (isDraggingApp || isAnyPopoverOpen()) return
    leaveTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
      leaveTimeoutId = null
      hideDock()
      return GLib.SOURCE_REMOVE
    })
  }

  // Fim de drag/menu: o GTK pode não emitir novo "leave", então decide pelo estado do controller
  onDockInteractionFinished = () => {
    if (!isRevealed || isDraggingApp || isAnyPopoverOpen()) return
    if (motion.contains_pointer) cancelLeaveTimeout()
    else scheduleLeaveTimeout()
  }

  motion.connect("enter", showDock)
  motion.connect("leave", scheduleLeaveTimeout)
  outerBox.add_controller(motion)

  bindInputRegion(win, applyInputRegion, () => onDockInteractionFinished?.())
}

// Reaplica a região de input quando a superfície é criada, redimensionada ou remapeada (ags toggle)
function bindInputRegion(win: Astal.Window, apply: () => void, onMap: () => void) {
  const bindSurface = () => {
    getSurface(win)?.connect("layout", apply)
    apply()
  }
  win.connect("realize", bindSurface)
  win.connect("map", () => {
    apply()
    onMap()
  })
  if (win.get_realized()) bindSurface()
}

export function Work(monitor = 0) {
  const hypr = Hyprland.get_default()
  const bat = Battery.get_default()
  const net = (Network as any).get_default()
  const wp = WirePlumber.get_default()

  const dockContainer = (<DockContainer hypr={hypr} bat={bat} net={net} wp={wp} />) as Gtk.Widget
  const revealer = new Gtk.Revealer({
    // transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
    // transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transition_type: Gtk.RevealerTransitionType.SLIDE_LEFT,
    transition_duration: 250,
    reveal_child: true, // Auto-hide desativado para teste (dock fixa); original: false
    child: dockContainer,
  })

  const peekBar = (
    <box class="dock-peek-bar" widthRequest={84} heightRequest={3} halign={Gtk.Align.CENTER} valign={Gtk.Align.END} visible={false} />
  ) as Gtk.Widget

  const outerBox = (
    // <box class="dock-wrapper" orientation={Gtk.Orientation.VERTICAL} spacing={0} halign={Gtk.Align.CENTER} valign={Gtk.Align.END}>
    <box class="dock-wrapper" orientation={Gtk.Orientation.HORIZONTAL} spacing={0} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
      {revealer}
      {peekBar}
    </box>
  ) as Gtk.Widget

  const win = (
    <window
      name="work-pill"
      class="WorkPill"
      monitor={monitor}
      application={app}
      visible={true}
      // exclusivity={Astal.Exclusivity.IGNORE}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      keymode={Astal.Keymode.ON_DEMAND}
      // anchor={Astal.WindowAnchor.BOTTOM}
      // anchor={Astal.WindowAnchor.TOP}
      anchor={Astal.WindowAnchor.RIGHT}
      // layer={Astal.Layer.OVERLAY}
      layer={Astal.Layer.TOP}
      // marginBottom={0}
      // marginTop={0}
      marginRight={0}
    >
      {outerBox}
    </window>
  ) as Astal.Window

  // Auto-hide desativado para teste (dock fixa) — descomente para restaurar
  // setupAutoHide(win, outerBox, revealer, peekBar)

  return win
}

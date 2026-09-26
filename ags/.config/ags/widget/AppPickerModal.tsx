import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import { scanSystemApps, addDockApp, DesktopApp } from "./dockStore"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

let modalInstance: Astal.Window | null = null
let searchEntryWidget: Gtk.SearchEntry | null = null
let appsListBox: Gtk.ListBox | null = null
let allAppsList: DesktopApp[] = []

export function closeAppPickerModal(): void {
  if (modalInstance) {
    modalInstance.set_visible(false)
  }
}

function renderAppIcon(iconName: string): Gtk.Widget {
  if (iconName.startsWith("/") || iconName.endsWith(".png") || iconName.endsWith(".svg")) {
    const img = Gtk.Image.new_from_file(iconName)
    img.set_pixel_size(32)
    img.add_css_class("picker-app-icon")
    return img
  }
  const img = new Gtk.Image({ iconName: iconName || "application-x-executable", pixelSize: 32 })
  img.add_css_class("picker-app-icon")
  return img
}

function createAppRow(item: DesktopApp): Gtk.Widget {
  const rowBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    cssClasses: ["picker-app-row"],
  })

  const iconWidget = renderAppIcon(item.icon)
  const textCol = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    valign: Gtk.Align.CENTER,
    hexpand: true,
  })

  const nameLbl = new Gtk.Label({
    label: item.name,
    xalign: 0,
    cssClasses: ["picker-app-name"],
  })
  const subLbl = new Gtk.Label({
    label: item.comment || item.cmd,
    xalign: 0,
    ellipsize: 3,
    cssClasses: ["picker-app-desc"],
  })

  textCol.append(nameLbl)
  textCol.append(subLbl)
  rowBox.append(iconWidget)
  rowBox.append(textCol)

  const clickGesture = new Gtk.GestureClick()
  clickGesture.connect("pressed", () => {
    addDockApp({
      name: item.name,
      cmd: item.cmd,
      icon: item.icon,
      className: item.id.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      color: "#38bdf8",
      matchRegex: item.id,
    })
    closeAppPickerModal()
  })
  rowBox.add_controller(clickGesture)

  return rowBox
}

function filterAndPopulateApps(filterText: string): void {
  if (!appsListBox) return

  let child = appsListBox.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    appsListBox.remove(child)
    child = next
  }

  const query = filterText.toLowerCase().trim()
  const filtered = query
    ? allAppsList.filter((a) => a.name.toLowerCase().includes(query) || a.cmd.toLowerCase().includes(query))
    : allAppsList

  // Lista 100% de todos os aplicativos sem corte artificial
  for (let i = 0; i < filtered.length; i++) {
    appsListBox.append(createAppRow(filtered[i]))
  }
}

export function openAppPickerModal(): void {
  if (!modalInstance) return
  allAppsList = scanSystemApps()
  if (searchEntryWidget) {
    searchEntryWidget.set_text("")
  }
  filterAndPopulateApps("")
  modalInstance.set_visible(true)
  if (searchEntryWidget) {
    searchEntryWidget.grab_focus()
  }
}

export function AppPickerModal(monitor = 0): Astal.Window {
  const search = new Gtk.SearchEntry({
    placeholderText: "Buscar aplicativo para adicionar ao Dock...",
    hexpand: true,
    cssClasses: ["picker-search-entry"],
  })
  searchEntryWidget = search
  search.connect("search-changed", (entry) => filterAndPopulateApps(entry.get_text()))

  const listBox = new Gtk.ListBox({
    selectionMode: Gtk.SelectionMode.NONE,
    cssClasses: ["picker-apps-list"],
  })
  appsListBox = listBox

  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    minContentHeight: 340,
    maxContentHeight: 460,
    hexpand: true,
    vexpand: true,
    cssClasses: ["picker-scrolled"],
    child: listBox,
  })

  const header = (
    <box class="picker-header" spacing={10}>
      <label class="picker-header-title" label="󰐕  Adicionar ao Dock" hexpand={true} xalign={0} />
      <button
        class="picker-walker-btn"
        tooltipText="Abrir no Walker (SUPER+Space)"
        onClicked={() => {
          closeAppPickerModal()
          GLib.spawn_command_line_async("omarchy-launch-walker")
        }}
      >
        <label label="󰈹 Walker" />
      </button>
      <button class="picker-close-btn" onClicked={closeAppPickerModal}>
        <label label="󰅖" />
      </button>
    </box>
  ) as Gtk.Widget

  const card = (
    <box
      class="picker-card"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={14}
      widthRequest={480}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    >
      {header}
      {search}
      {scrolled}
    </box>
  ) as Gtk.Widget

  const scrimClick = new Gtk.GestureClick()
  scrimClick.connect("pressed", (_g, _n, x, y) => {
    const [w, h] = [modalInstance?.get_width() || 1920, modalInstance?.get_height() || 1080]
    const cardW = 480
    const cardH = 500
    const minX = (w - cardW) / 2
    const maxX = (w + cardW) / 2
    const minY = (h - cardH) / 2
    const maxY = (h + cardH) / 2
    if (x < minX || x > maxX || y < minY || y > maxY) {
      closeAppPickerModal()
    }
  })

  const scrim = (
    <box class="picker-scrim" hexpand={true} vexpand={true} halign={Gtk.Align.FILL} valign={Gtk.Align.FILL}>
      {card}
    </box>
  ) as Gtk.Widget
  scrim.add_controller(scrimClick)

  const win = (
    <window
      name="app-picker-modal"
      class="AppPickerModal"
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
      closeAppPickerModal()
      return true
    }
    return false
  })
  win.add_controller(keyController)

  modalInstance = win
  return win
}

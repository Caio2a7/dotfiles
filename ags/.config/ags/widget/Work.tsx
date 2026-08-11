import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createBinding, createComputed, For } from "ags"
import { createPoll } from "ags/time"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Network from "gi://AstalNetwork"
import GLib from "gi://GLib"
import cairo from "gi://cairo"

const { RIGHT } = Astal.WindowAnchor
const V = Gtk.Orientation.VERTICAL

function getSurface(win: Astal.Window): Gdk.Surface | null {
  return (win as unknown as Gtk.Native).get_surface() ?? null
}

function setPassthrough(surface: Gdk.Surface, enabled: boolean) {
  if (enabled) {
    const emptyRegion = new cairo.Region()
    surface.set_input_region(emptyRegion)
  } else {
    surface.set_input_region(null)
  }
}

export function Work(monitor = 0) {
  const hypr = Hyprland.get_default()
  const bat = Battery.get_default()
  const net = Network.get_default()

  const workspaces = createBinding(hypr, "workspaces")
  const focusedWs = createBinding(hypr, "focused-workspace")
  const sorted = createComputed(() =>
    [...workspaces()]
      .filter((w: Hyprland.Workspace) => w.id > 0)
      .sort((a: Hyprland.Workspace, b: Hyprland.Workspace) => a.id - b.id)
  )

  const hh = createPoll("--", 1000, "date '+%H'")
  const mm = createPoll("--", 1000, "date '+%M'")
  const dd = createPoll("--", 60_000, "date '+%d'")
  const mo = createPoll("--", 60_000, "date '+%m'")

  const batColorClass = createComputed(() => {
    const p = bat.percentage
    if (p <= 0.15) return "bat-red"
    if (p <= 0.30) return "bat-orange"
    if (p <= 0.50) return "bat-yellow"
    return "bat-green"
  })

  const batLevelClass = createComputed(() => {
    if (bat.charging) return "bat-charging"
    const p = bat.percentage
    if (p <= 0.05) return "bat-empty"
    if (p <= 0.20) return "bat-low"
    if (p <= 0.40) return "bat-mid-low"
    if (p <= 0.60) return "bat-mid"
    if (p <= 0.85) return "bat-high"
    return "bat-full"
  })

  const finalBatClass = createComputed(() => `sys-icon bat-icon ${batColorClass()} ${batLevelClass()}`)

  const batteryLevelIcon = createComputed(() => {
    if (bat.charging) return "󰂄"
    const p = bat.percentage
    if (p <= 0.05) return "󰂎"
    if (p <= 0.20) return "󰁻"
    if (p <= 0.40) return "󰁽"
    if (p <= 0.60) return "󰁿"
    if (p <= 0.85) return "󰂁"
    return "󰁹"
  })

  const netIcon = createComputed(() => {
    if (net.primary === Network.Primary.WIFI) return "󰤨"
    if (net.primary === Network.Primary.WIRED) return "󰈀"
    return "󰤭"
  })

  const netTypeClass = createComputed(() => {
    if (net.primary === Network.Primary.WIFI) return "net-wifi"
    if (net.primary === Network.Primary.WIRED) return "net-wired"
    return "net-off"
  })

  const netColorClass = createComputed(() => {
    const isConnected = net.primary === Network.Primary.WIFI || net.primary === Network.Primary.WIRED
    const color = isConnected ? "net-ice-blue" : "net-red"
    return `sys-icon net-icon ${color} ${netTypeClass()}`
  })

  let hidden = false
  let pollId: number | null = null

  function showPill(win: Astal.Window, content: Gtk.Widget) {
    hidden = false

    if (pollId !== null) {
      GLib.source_remove(pollId)
      pollId = null
    }

    const surface = getSurface(win)
    if (surface) setPassthrough(surface, false)

    content.remove_css_class("ghost")
  }

  function hidePill(win: Astal.Window, content: Gtk.Widget) {
    hidden = true

    const surface = getSurface(win)
    if (!surface) return

    content.add_css_class("ghost")
    setPassthrough(surface, true)

    pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      try {
        if (!hidden) return GLib.SOURCE_REMOVE

        const [ok, stdout] = GLib.spawn_command_line_sync("hyprctl cursorpos -j")
        if (!ok || !stdout) return GLib.SOURCE_CONTINUE
        const cursor = JSON.parse(new TextDecoder().decode(stdout)) as { x: number; y: number }

        const gdkMonitor = Gdk.Display.get_default()?.get_monitor_at_surface(surface)
        if (!gdkMonitor) return GLib.SOURCE_CONTINUE

        const geo = gdkMonitor.get_geometry()
        const ww = win.get_width()
        const wh = win.get_height()

        // Pill está ancorada à direita com marginRight=12, centralizada verticalmente
        const wx = geo.x + geo.width - ww - 12
        const wy = geo.y + Math.floor((geo.height - wh) / 2)

        const inside =
          cursor.x >= wx &&
          cursor.x <= wx + ww &&
          cursor.y >= wy &&
          cursor.y <= wy + wh

        if (!inside) {
          showPill(win, content)
          return GLib.SOURCE_REMOVE
        }

        return GLib.SOURCE_CONTINUE
      } catch (_) {
        showPill(win, content)
        return GLib.SOURCE_REMOVE
      }
    })
  }

  const inner = (
    <box class="pill work-pill" orientation={V} spacing={0}
         halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
      <box class="ws-section" orientation={V} spacing={5}
           halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <For each={sorted}>
          {(ws: Hyprland.Workspace) => (
            <button
              class={createComputed(() =>
                focusedWs()?.id === ws.id ? "ws-num active" : "ws-num"
              )}
              onClicked={() => ws.focus()}
              halign={Gtk.Align.CENTER}
              valign={Gtk.Align.CENTER}
            >
              <label
                class="ws-num-label"
                label={`${ws.id}`}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
              />
            </button>
          )}
        </For>
      </box>
      <box class="section-sep" />
      <box class="clock-section" orientation={V} spacing={0}
           halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <label class="clock-hh" label={hh} halign={Gtk.Align.CENTER} />
        <label class="clock-mm" label={mm} halign={Gtk.Align.CENTER} />
        <box class="clock-sep" />
        <label class="clock-dd" label={dd} halign={Gtk.Align.CENTER} />
        <label class="clock-mo" label={mo} halign={Gtk.Align.CENTER} />
      </box>
      <box class="section-sep" />
      <box class="sys-section" orientation={V} spacing={8}
           halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <label
          class={finalBatClass}
          label={batteryLevelIcon}
          halign={Gtk.Align.CENTER}
        />
        <label
          class={netColorClass}
          label={netIcon}
          halign={Gtk.Align.CENTER}
        />
      </box>
    </box>
  ) as Gtk.Widget

  const outer = (
    <box class="pill-hover" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
      {inner}
    </box>
  ) as Gtk.Widget

  const win = (
    <window
      name="work-pill"
      class="WorkPill"
      monitor={monitor}
      application={app}
      visible={true}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={RIGHT}
      layer={Astal.Layer.OVERLAY}
      marginRight={12}
      valign={Gtk.Align.CENTER}
    >
      {outer}
    </window>
  ) as Astal.Window

  const motion = new Gtk.EventControllerMotion()
  win.add_controller(motion)

  motion.connect("enter", () => {
    if (!hidden) hidePill(win, outer)
  })

  return win
}

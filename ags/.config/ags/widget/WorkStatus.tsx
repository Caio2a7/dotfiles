import { Gtk } from "ags/gtk4"
import { createBinding, createComputed, For } from "ags"
import { createPoll } from "ags/time"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Network from "gi://AstalNetwork"
import WirePlumber from "gi://AstalWp"
import GLib from "gi://GLib"

// ─── Workspaces Section ───────────────────────────────────────────────────────
export function WorkspacesSection({ hypr }: { hypr: Hyprland.Hyprland }) {
  const workspaces = createBinding(hypr, "workspaces")
  const focusedWs = createBinding(hypr as any, "focused-workspace")
  const sorted = createComputed(() =>
    [...(workspaces() as Hyprland.Workspace[])]
      .filter((w: Hyprland.Workspace) => w.id > 0)
      .sort((a: Hyprland.Workspace, b: Hyprland.Workspace) => a.id - b.id)
  )

  return (
    // <box class="apple-workspaces-capsule" spacing={4} valign={Gtk.Align.CENTER}>
    <box class="apple-workspaces-capsule" orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
      <For each={sorted}>
        {(ws: Hyprland.Workspace) => (
          <button
            class={createComputed(() => ((focusedWs() as any)?.id === ws.id ? "apple-space-btn active" : "apple-space-btn"))}
            onClicked={() => ws.focus()}
            valign={Gtk.Align.CENTER}
          >
            <label class="apple-space-num" label={`${ws.id}`} valign={Gtk.Align.CENTER} />
          </button>
        )}
      </For>
    </box>
  )
}

// ─── Audio & Brightness Controls Section (Asa Esquerda) ──────────────────────
export function AudioControlsSection({ wp }: { wp: WirePlumber.WirePlumber | null }) {
  const speaker = wp?.defaultSpeaker
  const mic = wp?.defaultMicrophone

  const vol = speaker ? createBinding(speaker, "volume") : () => 1
  const muted = speaker ? createBinding(speaker, "mute") : () => false
  const micVol = mic ? createBinding(mic, "volume") : () => 1
  const micMuted = mic ? createBinding(mic, "mute") : () => false

  const volIcon = createComputed(() => {
    if (muted()) return "󰖁"
    const v = vol()
    return v > 0.65 ? "󰕾" : v > 0.2 ? "󰖀" : "󰕿"
  })
  // const volPct = createComputed(() => (muted() ? "Mudo" : `${Math.round(vol() * 100)}%`))
  const volPct = createComputed(() => (muted() ? "Mudo" : `${Math.round(vol() * 100)}`))

  const micIcon = createComputed(() => (micMuted() ? "󰍭" : "󰍬"))
  // const micPct = createComputed(() => (micMuted() ? "Mudo" : `${Math.round(micVol() * 100)}%`))
  const micPct = createComputed(() => (micMuted() ? "Mudo" : `${Math.round(micVol() * 100)}`))

  return (
    // <box class="apple-status-capsule left-capsule" spacing={6} valign={Gtk.Align.CENTER}>
    <box class="apple-status-capsule left-capsule" orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
      {/* 1. Volume */}
      <button
        class="apple-status-btn vol-btn"
        valign={Gtk.Align.CENTER}
        tooltipText={createComputed(() => (muted() ? "Desmutar Áudio" : `Volume: ${volPct()}`))}
        onClicked={() => {
          if (speaker) speaker.mute = !speaker.mute
        }}
      >
        {/* <box spacing={6} valign={Gtk.Align.CENTER}> */}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
          <label class={createComputed(() => (muted() ? "apple-icon vol-muted" : "apple-icon vol-active"))} label={volIcon} valign={Gtk.Align.CENTER} />
          <label class="apple-status-text" label={volPct} valign={Gtk.Align.CENTER} />
        </box>
      </button>

      {/* <box class="apple-status-sep" valign={Gtk.Align.CENTER} /> */}
      <box class="apple-status-sep" halign={Gtk.Align.CENTER} />

      {/* 2. Microfone (com porcentagem) */}
      <button
        class="apple-status-btn mic-btn"
        valign={Gtk.Align.CENTER}
        tooltipText={createComputed(() => (micMuted() ? "Desmutar Microfone" : `Microfone: ${micPct()}`))}
        onClicked={() => {
          if (mic) mic.mute = !mic.mute
        }}
      >
        {/* <box spacing={6} valign={Gtk.Align.CENTER}> */}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
          <label class={createComputed(() => (micMuted() ? "apple-icon mic-muted" : "apple-icon mic-active"))} label={micIcon} valign={Gtk.Align.CENTER} />
          <label class="apple-status-text" label={micPct} valign={Gtk.Align.CENTER} />
        </box>
      </button>
    </box>
  )
}

function getBatteryIcon(bat: Battery.Battery): string {
  if (bat.charging) return "󰂄"
  const p = bat.percentage
  if (p <= 0.05) return "󰂎"
  if (p <= 0.20) return "󰁻"
  if (p <= 0.40) return "󰁽"
  if (p <= 0.60) return "󰁿"
  if (p <= 0.85) return "󰂁"
  return "󰁹"
}

// ─── Status Section (Asa Direita) ─────────────────────────────────────────────
export function StatusSection({ bat, net }: { bat: Battery.Battery; net: Network.Network }) {
  const batPct = createPoll("0%", 5000, () => `${Math.round((bat.percentage || 0) * 100)}%`)
  const batteryIcon = createComputed(() => getBatteryIcon(bat))
  const netIcon = createComputed(() => {
    if (net.primary === Network.Primary.WIFI) return "󰤨"
    if (net.primary === Network.Primary.WIRED) return "󰈀"
    return "󰤭"
  })
  // old: Nerd Font glyph labels (netIcon/batteryIcon) had asymmetric bearings; symbolic icons are centered
  const netIconName = createComputed(() => {
    if (net.primary === Network.Primary.WIFI) return net.wifi?.iconName || "network-wireless-symbolic"
    if (net.primary === Network.Primary.WIRED) return "network-wired-symbolic"
    return "network-wireless-offline-symbolic"
  })
  const batPercentage = createBinding(bat, "percentage")
  const batClass = createComputed(() => {
    const p = batPercentage()
    // old: p >= 0.5 ? "battery-ok" : p >= 0.3 ? "battery-mid" : p >= 0.15 ? "battery-low" : "battery-critical"
    const level =
      p >= 0.6 ? "battery-ok"
      : p >= 0.45 ? "battery-soft"
      : p >= 0.3 ? "battery-mid"
      : p >= 0.2 ? "battery-low"
      : p >= 0.1 ? "battery-critical"
      : "battery-empty"
    return `apple-icon ${level}`
  })
  // old: const batteryIconName = createBinding(bat, "iconName") // inclui variante -charging (raio)
  const batteryIconName = createComputed(() => `battery-level-${Math.min(100, Math.floor(batPercentage() * 10) * 10)}-symbolic`)
  const isConnected = createComputed(
    () => net.primary === Network.Primary.WIFI || net.primary === Network.Primary.WIRED
  )

  const hh = createPoll("--", 1000, "date '+%H'")
  const mm = createPoll("--", 1000, "date '+%M'")
  const dd = createPoll("--", 60_000, "date '+%d'")
  const moStr = createPoll("--", 60_000, "date '+%b'")

  return (
    // <box class="apple-status-capsule right-capsule" spacing={6} valign={Gtk.Align.CENTER}>
    <box class="apple-status-capsule right-capsule" orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
      {/* 1. Wi-Fi */}
      <box
        class="apple-status-item wifi-item"
        // valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        tooltipText={createComputed(() => (isConnected() ? "Wi-Fi Conectado" : "Desconectado"))}
      >
        {/* <label
          class={createComputed(() => (isConnected() ? "apple-icon wifi-on" : "apple-icon wifi-off"))}
          label={netIcon}
          valign={Gtk.Align.CENTER}
          halign={Gtk.Align.CENTER}
          hexpand
        /> */}
        <image
          class={createComputed(() => (isConnected() ? "apple-icon wifi-on" : "apple-icon wifi-off"))}
          iconName={netIconName}
          pixelSize={16}
          halign={Gtk.Align.CENTER}
          hexpand
        />
      </box>

      {/* <box class="apple-status-sep" valign={Gtk.Align.CENTER} /> */}
      <box class="apple-status-sep" halign={Gtk.Align.CENTER} />

      {/* 2. Bateria */}
      <box
        class="apple-status-item bat-item"
        // orientation: horizontal, valign CENTER
        orientation={Gtk.Orientation.VERTICAL}
        spacing={2}
        halign={Gtk.Align.CENTER}
        // old: tooltipText={createComputed(() => (bat.charging ? "Bateria Carregando" : "Nível da Bateria"))}
        tooltipText={createComputed(() => `${batPct()}${bat.charging ? " · Carregando" : ""}`)}
      >
        <image
          // old: class by bat-low / bat-charging / bat-normal
          class={batClass}
          iconName={batteryIconName}
          pixelSize={16}
          halign={Gtk.Align.CENTER}
          hexpand
        />
        {/* <label class="apple-status-text" label={batPct} valign={Gtk.Align.CENTER} /> */}
      </box>

      {/* <box class="apple-status-sep" valign={Gtk.Align.CENTER} /> */}
      <box class="apple-status-sep" halign={Gtk.Align.CENTER} />

      {/* 3. Relógio & Data */}
      {/* <box class="apple-status-item clock-item" spacing={6} valign={Gtk.Align.CENTER}> */}
      <box class="apple-status-item clock-item" orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
        {/* <label class="apple-time-text" label={createComputed(() => `${hh()}:${mm()}`)} valign={Gtk.Align.CENTER} /> */}
        <label class="apple-time-text" label={createComputed(() => `${hh()}\n${mm()}`)} halign={Gtk.Align.CENTER} justify={Gtk.Justification.CENTER} />
        <box class="apple-clock-dot" halign={Gtk.Align.CENTER} />
        {/* <label class="apple-date-text" label={createComputed(() => `${dd()} ${moStr()}`)} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} /> */}
        <label class="apple-date-text" label={createComputed(() => `${dd()}\n${moStr()}`)} justify={Gtk.Justification.CENTER} halign={Gtk.Align.CENTER} />
      </box>
    </box>
  )
}

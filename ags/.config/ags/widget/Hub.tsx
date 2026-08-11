import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createBinding, createComputed, For } from "ags"
import { createPoll } from "ags/time"
import Hyprland from "gi://AstalHyprland"
import WirePlumber from "gi://AstalWp"
import Battery from "gi://AstalBattery"
import Mpris from "gi://AstalMpris"
import GLib from "gi://GLib"

const V = Gtk.Orientation.VERTICAL

function trySpawn(cmd: string): boolean {
  try {
    const safeCmd = cmd.includes("bash -c") ? cmd : `bash -c "${cmd.replace(/"/g, '\\"')} 2>/dev/null || true"`
    GLib.spawn_command_line_async(safeCmd)
    return true
  } catch {
    return false
  }
}

const CMD_CPU =
  "python3 -c \"" +
  "import time;" +
  "f=open('/proc/stat');a=list(map(int,f.readline().split()[1:]));f.close();" +
  "time.sleep(0.4);" +
  "f=open('/proc/stat');b=list(map(int,f.readline().split()[1:]));f.close();" +
  "d=[b[i]-a[i] for i in range(len(a))];total=sum(d);idle=d[3]+d[4];" +
  "print(int((total-idle)/total*100) if total else 0)" +
  "\""

const CMD_RAM =
  "awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{printf\"%d\",(t>0)?(t-a)/t*100:0}' /proc/meminfo"

const CMD_DISK =
  "python3 -c \"" +
  "import os;s=os.statvfs('/');t=s.f_blocks*s.f_frsize;f=s.f_bavail*s.f_frsize;" +
  "print(int((t-f)/t*100) if t else 0)" +
  "\""

const CMD_GPU =
  "python3 -c \"" +
  "import subprocess as s, glob, os\n" +
  "vals = []\n" +
  "try:\n" +
  "    r = s.run(['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=1)\n" +
  "    if r.returncode == 0 and r.stdout.strip().isdigit(): vals.append(int(r.stdout.strip()))\n" +
  "except: pass\n" +
  "for card in glob.glob('/sys/class/drm/card*'):\n" +
  "    cur_p = os.path.join(card, 'gt_cur_freq_mhz')\n" +
  "    act_p = os.path.join(card, 'gt_act_freq_mhz')\n" +
  "    max_p = os.path.join(card, 'gt_max_freq_mhz')\n" +
  "    min_p = os.path.join(card, 'gt_min_freq_mhz')\n" +
  "    if os.path.exists(max_p):\n" +
  "        try:\n" +
  "            max_f = int(open(max_p).read().strip())\n" +
  "            min_f = int(open(min_p).read().strip()) if os.path.exists(min_p) else 0\n" +
  "            act_f = int(open(act_p).read().strip()) if os.path.exists(act_p) else 0\n" +
  "            cur_f = int(open(cur_p).read().strip()) if os.path.exists(cur_p) else 0\n" +
  "            freq = max(act_f, cur_f)\n" +
  "            if max_f > min_f:\n" +
  "                pct = int((freq - min_f) / (max_f - min_f) * 100)\n" +
  "                vals.append(max(0, min(100, pct)))\n" +
  "        except: pass\n" +
  "for p in glob.glob('/sys/class/drm/card*/device/gpu_busy_percent'):\n" +
  "    try: vals.append(int(open(p).read().strip()))\n" +
  "    except: pass\n" +
  "print(max(vals) if vals else 0)\n" +
  "\""

const CMD_TEMP =
  "python3 -c \"" +
  "import glob\n" +
  "temps = []\n" +
  "for p in glob.glob('/sys/class/thermal/thermal_zone*/temp') + glob.glob('/sys/class/hwmon/hwmon*/temp1_input'):\n" +
  "    try:\n" +
  "        v = int(open(p).read().strip())\n" +
  "        if v > 1000: v = int(v / 1000)\n" +
  "        if 0 < v < 110: temps.append(v)\n" +
  "    except: pass\n" +
  "print(max(temps) if temps else 0)\n" +
  "\""

const CMD_NET_USAGE =
  "python3 -c \"" +
  "import time, math\n" +
  "def b():\n" +
  "    rx, tx = 0, 0\n" +
  "    with open('/proc/net/dev') as f:\n" +
  "        for l in f.readlines()[2:]:\n" +
  "            p = l.split(':')\n" +
  "            if len(p) < 2 or p[0].strip() == 'lo': continue\n" +
  "            fld = p[1].split()\n" +
  "            rx += int(fld[0]); tx += int(fld[8])\n" +
  "    return rx + tx\n" +
  "b1 = b()\n" +
  "time.sleep(0.3)\n" +
  "b2 = b()\n" +
  "rate = max(0, (b2 - b1) / 0.3)\n" +
  "if rate <= 1024: pct = 0\n" +
  "else:\n" +
  "    log_val = math.log10(rate)\n" +
  "    min_log = math.log10(1024)\n" +
  "    max_log = math.log10(5 * 1024 * 1024)\n" +
  "    pct = int(max(5, min(100, ((log_val - min_log) / (max_log - min_log)) * 95 + 5)))\n" +
  "print(pct)\n" +
  "\""

const CMD_NET_STATUS =
  "python3 -c \"" +
  "import subprocess as s;" +
  "r=s.run(['nmcli','-t','-f','NAME,TYPE,STATE','con','show','--active']," +
    "capture_output=True,text=True);" +
  "lines=[l for l in r.stdout.strip().split('\\n') if l.endswith(':activated')];" +
  "types={p.split(':')[-2]:':'.join(p.split(':')[:-2]) for p in lines if len(p.split(':'))>=3};" +
  "(" +
    "print('vpn:'+types['vpn']) if 'vpn' in types else " +
    "print('vpn:'+types['wireguard']) if 'wireguard' in types else " +
    "print('wifi:'+types['802-11-wireless']) if '802-11-wireless' in types else " +
    "print('eth:Ethernet') if '802-3-ethernet' in types else " +
    "print('offline:Offline')" +
  ")\""

const CMD_NET_SIGNAL =
  "python3 -c \"" +
  "import subprocess as s;" +
  "r=s.run(['nmcli','-t','-f','active,signal','dev','wifi']," +
    "capture_output=True,text=True);" +
  "lines=[l for l in r.stdout.strip().split('\\n') if l.startswith('yes:')];" +
  "print(lines[0].split(':')[1] if lines else '0')" +
  "\""

function Clock() {
  const time    = createPoll("--:--", 1000,   "date '+%H:%M'")
  const dateStr = createPoll("",      60_000, "date '+%a, %d %b'")

  return (
    <box class="hub-clock" spacing={8} valign={Gtk.Align.CENTER}>
      <label class="hub-clock-time" label={time}    valign={Gtk.Align.CENTER} />
      <label class="hub-clock-dot"  label="•"       valign={Gtk.Align.CENTER} />
      <label class="hub-clock-date" label={dateStr} halign={Gtk.Align.START} valign={Gtk.Align.CENTER} />
    </box>
  )
}

function Workspaces() {
  const hypr       = Hyprland.get_default()
  const workspaces = createBinding(hypr, "workspaces")
  const focusedWs  = createBinding(hypr, "focused-workspace")

  const sorted = createComputed(() =>
    [...workspaces()]
      .filter((w: Hyprland.Workspace) => w.id > 0)
      .sort((a: Hyprland.Workspace, b: Hyprland.Workspace) => a.id - b.id)
  )

  return (
    <box class="hub-workspaces" spacing={5} halign={Gtk.Align.START}>
      <For each={sorted}>
        {(ws: Hyprland.Workspace) => (
          <button
            class={createComputed(() =>
              focusedWs()?.id === ws.id ? "ws-btn active" : "ws-btn"
            )}
            onClicked={() => ws.focus()}
          >
            <label label={`${ws.id}`} />
          </button>
        )}
      </For>
    </box>
  )
}

function getAppIcon(clsName: string, title: string): string {
  const c = (clsName || "").toLowerCase()
  const t = (title || "").toLowerCase()

  if (t.includes("nvim") || t.includes("neovim") || c.includes("nvim") || c.includes("neovim")) return ""
  if (t.includes("vim")) return ""
  if (c.includes("kitty") || c.includes("alacritty") || c.includes("foot") || c.includes("terminal") || c.includes("ghostty") || c.includes("wezterm") || c.includes("st")) return "󰆍"
  if (c.includes("firefox") || c.includes("zen") || c.includes("waterfox")) return "󰈹"
  if (c.includes("chrome") || c.includes("chromium") || c.includes("brave") || c.includes("thorium")) return "󰊯"
  if (c.includes("code") || c.includes("vscodium")) return "󰨞"
  if (c.includes("discord") || c.includes("vesktop") || c.includes("webcord")) return "󰙯"
  if (c.includes("spotify")) return "󰓇"
  if (c.includes("thunar") || c.includes("nautilus") || c.includes("dolphin") || c.includes("pcmanfm")) return "󰉋"
  if (c.includes("obsidian")) return "󱓧"
  if (c.includes("steam")) return "󰓓"
  if (c.includes("mpv") || c.includes("vlc")) return "󰕼"

  return "󰘔"
}

function ActiveWindow() {
  const hypr   = Hyprland.get_default()
  const client = createBinding(hypr, "focused-client")

  const appName  = createComputed(() => client()?.class ?? "Desktop")
  const rawTitle = createComputed(() => client()?.title ?? "")

  const title = createComputed(() => {
    const t = rawTitle()
    return t.length > 24 ? t.slice(0, 22) + "…" : t
  })

  const appIcon = createComputed(() => getAppIcon(appName(), rawTitle()))

  const fullText = createComputed(() => {
    const app = appName()
    const t = title()
    if (!t || t.toLowerCase() === app.toLowerCase() || app === "Desktop") return app
    return `${app} — ${t}`
  })

  return (
    <box class="hub-window-single" spacing={6} valign={Gtk.Align.CENTER}>
      <label class="window-icon" label={appIcon} valign={Gtk.Align.CENTER} />
      <label class="window-single-text" label={fullText} halign={Gtk.Align.START} valign={Gtk.Align.CENTER} hexpand={true} />
    </box>
  )
}

function StatCard({ icon, name, rawValue, cls, unit = "%" }: {
  icon: string
  name: string
  rawValue: () => string
  cls: any
  unit?: string
}) {
  const numVal = createComputed(() => {
    const n = parseInt(rawValue(), 10)
    return isNaN(n) ? 0 : Math.min(100, Math.max(0, n))
  })

  const cardClass = createComputed(() => {
    const c = typeof cls === "function" ? cls() : cls
    return `hub-syscard ${c}`
  })

  const levelClass = createComputed(() => {
    const c = typeof cls === "function" ? cls() : cls
    return `syscard-level ${c}`
  })

  return (
    <box class={cardClass} orientation={V} spacing={3} halign={Gtk.Align.CENTER}>
      <box orientation={V} spacing={1} halign={Gtk.Align.CENTER}>
        <label class="syscard-icon" label={icon} halign={Gtk.Align.CENTER} />
        <label class="syscard-value"
          label={createComputed(() => `${numVal()}${unit}`)}
          halign={Gtk.Align.CENTER}
        />
      </box>
      <levelbar
        class={levelClass}
        orientation={Gtk.Orientation.VERTICAL}
        inverted={true}
        minValue={0}
        maxValue={100}
        value={numVal}
        halign={Gtk.Align.CENTER}
      />
      <label class="syscard-name" label={name} halign={Gtk.Align.CENTER} />
    </box>
  )
}

function SystemStats() {
  const cpu  = createPoll("0", 2000,   CMD_CPU)
  const ram  = createPoll("0", 3000,   CMD_RAM)
  const disk = createPoll("0", 30_000, CMD_DISK)
  const gpu  = createPoll("0", 3000,   CMD_GPU)
  const net  = createPoll("0", 3000,   CMD_NET_USAGE)
  const temp = createPoll("0", 3000,   CMD_TEMP)

  const tempCls = createComputed(() => {
    const t = parseInt(temp(), 10) || 0
    if (t <= 45) return "temp-ideal"
    if (t <= 58) return "temp-low"
    if (t <= 70) return "temp-mid"
    if (t <= 82) return "temp-high"
    return "temp-crit"
  })

  return (
    <box orientation={V} spacing={8} class="hub-sysgrid" halign={Gtk.Align.START}>
      <box spacing={8} halign={Gtk.Align.START}>
        <StatCard icon="󰘚" name="CPU"  rawValue={cpu}  cls="cpu"  />
        <StatCard icon="󰍛" name="RAM"  rawValue={ram}  cls="ram"  />
        <StatCard icon="󰋊" name="DISK" rawValue={disk} cls="disk" />
      </box>
      <box spacing={8} halign={Gtk.Align.START}>
        <StatCard icon="󰢮" name="GPU"  rawValue={gpu}  cls="gpu"  />
        <StatCard icon="󰖩" name="REDE" rawValue={net}  cls="net"  />
        <StatCard icon="󰔏" name="TEMP" rawValue={temp} cls={tempCls} unit="°C" />
      </box>
    </box>
  )
}

function Volume() {
  const wp = WirePlumber.get_default()
  if (!wp) return <box />
  const speaker = wp.defaultSpeaker
  if (!speaker) return <box />

  const vol   = createBinding(speaker, "volume")
  const muted = createBinding(speaker, "mute")

  const icon = createComputed(() => {
    if (muted()) return "󰖁"
    const v = vol()
    return v > 0.65 ? "󰕾" : v > 0.2 ? "󰖀" : "󰕿"
  })
  const pctLabel = createComputed(() =>
    muted() ? "Mudo" : `${Math.round(vol() * 100)}%`
  )

  return (
    <box class="hub-stat volume" spacing={10} valign={Gtk.Align.CENTER}>
      <button
        class="mute-btn"
        valign={Gtk.Align.CENTER}
        tooltipText={createComputed(() => muted() ? "Desmutar" : "Mutar")}
        onClicked={() => { speaker.mute = !speaker.mute }}
      >
        <label class="stat-icon" label={icon} valign={Gtk.Align.CENTER} />
      </button>
      <slider
        class="vol-slider"
        hexpand={true}
        valign={Gtk.Align.CENTER}
        min={0} max={1} step={0.02}
        value={createBinding(speaker, "volume")}
        onValueChanged={(self: any) => {
          speaker.mute   = false
          speaker.volume = self.value
        }}
      />
      <label class="stat-value" label={pctLabel} valign={Gtk.Align.CENTER} />
    </box>
  )
}

function Brightness() {
  const adjustment = new Gtk.Adjustment({ value: 100, lower: 0, upper: 100, step_increment: 1 })
  const brightness = createBinding(adjustment, "value")

  const icon = createComputed(() => {
    const v = brightness()
    return v > 66 ? "󰃠" : v > 33 ? "󰃟" : "󰃞"
  })

  const pctLabel = createComputed(() => `${Math.round(brightness())}%`)

  let debounceId: number | null = null

  return (
    <box class="hub-stat brightness" spacing={10} valign={Gtk.Align.CENTER}>
      <label class="stat-icon" label={icon} valign={Gtk.Align.CENTER} />
      <slider
        class="brightness-slider"
        hexpand={true}
        valign={Gtk.Align.CENTER}
        adjustment={adjustment}
        value={100}
        onValueChanged={(self: any) => {
          const val = Math.round(self.value)
          const gamma = val

          if (debounceId !== null) {
            GLib.source_remove(debounceId)
            debounceId = null
          }
          debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            const cmd = val >= 100
              ? `bash -c 'pkill -9 hyprsunset'`
              : `bash -c 'pkill -9 hyprsunset; sleep 0.05; hyprsunset --gamma ${gamma} &'`
            trySpawn(cmd)
            debounceId = null
            return GLib.SOURCE_REMOVE
          })
        }}
      />
      <label class="stat-value" label={pctLabel} valign={Gtk.Align.CENTER} />
    </box>
  )
}

function NetworkWidget() {
  const status = createPoll("offline:Offline", 4000, CMD_NET_STATUS)
  const signal = createPoll("0",               4000, CMD_NET_SIGNAL)

  const connType = createComputed(() => status().split(":")[0])
  const connName = createComputed(() => status().split(":").slice(1).join(":") || "Offline")
  const sigNum   = createComputed(() => Math.max(0, parseInt(signal(), 10) || 0))

  const icon = createComputed(() => {
    switch (connType()) {
      case "vpn":     return "󰦝"
      case "eth":     return "󰈀"
      case "offline": return "󰤭"
      default: {
        const s = sigNum()
        return s > 75 ? "󰤨" : s > 50 ? "󰤥" : s > 25 ? "󰤢" : "󰤟"
      }
    }
  })

  const sigText = createComputed(() =>
    connType() === "wifi" && sigNum() > 0 ? `${sigNum()}%` : ""
  )

  return (
    <button
      class="hub-stat network"
      tooltipText="Gerenciar redes"
      onClicked={() => trySpawn("omarchy-launch-wifi")}
    >
      <box spacing={10} valign={Gtk.Align.CENTER}>
        <label class="stat-icon" label={icon} valign={Gtk.Align.CENTER} />
        <label class="stat-value" label={connName} hexpand={true} halign={Gtk.Align.START} valign={Gtk.Align.CENTER} />
        <label class="stat-sub net-sig" label={sigText} halign={Gtk.Align.END} valign={Gtk.Align.CENTER} />
        <label class="stat-arrow" label="󰅂" valign={Gtk.Align.CENTER} />
      </box>
    </button>
  )
}

function BatteryWidget() {
  const bat = Battery.get_default()
  if (!bat) return <box />

  const pct      = createBinding(bat, "percentage")
  const charging = createBinding(bat, "charging")

  const icon = createComputed(() => {
    if (charging()) return "󰂄"
    const p = pct() * 100
    return p > 80 ? "󱃁" : p > 60 ? "󰂀" : p > 40 ? "󱊡" : p > 20 ? "󱊠" : "󱊟"
  })
  const value    = createComputed(() => `${Math.round(pct() * 100)}%`)
  const sublabel = createComputed(() => charging() ? "CARREGANDO" : "BATERIA")
  const cls      = createComputed(() =>
    pct() < 0.2 ? "hub-stat battery low" : "hub-stat battery"
  )

  return (
    <box class={cls} spacing={10} valign={Gtk.Align.CENTER}>
      <label class="stat-icon" label={icon} valign={Gtk.Align.CENTER} />
      <label class="stat-sub battery-text" label={sublabel} hexpand={true} halign={Gtk.Align.START} valign={Gtk.Align.CENTER} />
      <label class="stat-value battery-val" label={value} halign={Gtk.Align.END} valign={Gtk.Align.CENTER} />
    </box>
  )
}

const CMD_MEDIA_INFO =
  "python3 -c \"" +
  "import subprocess as s;" +
  "r=s.run(['playerctl','metadata','--format','{{status}}:::{{artist}}:::{{title}}'],capture_output=True,text=True);" +
  "print(r.stdout.strip() if r.returncode==0 and r.stdout.strip() else 'Stopped:::Nenhum tocador ativo:::Sem mídia em reprodução')" +
  "\""

function Media() {
  const mediaInfo = createPoll("Stopped:::Nenhum tocador ativo:::Sem mídia em reprodução", 1500, CMD_MEDIA_INFO)

  const parts = createComputed(() => {
    const raw = mediaInfo()
    const p = raw.split(":::")
    return {
      status: (p[0] || "Stopped").trim(),
      artist: (p[1] || "Nenhum tocador ativo").trim(),
      title:  (p[2] || "Sem mídia em reprodução").trim(),
    }
  })

  const isPlaying = createComputed(() => parts().status.toLowerCase() === "playing")
  const playIcon  = createComputed(() => isPlaying() ? "󰏤" : "󰐊")

  const titleText = createComputed(() => {
    const t = parts().title
    return t.length > 24 ? t.slice(0, 22) + "…" : t
  })

  const artistText = createComputed(() => {
    const a = parts().artist
    return a.length > 26 ? a.slice(0, 24) + "…" : a
  })

  return (
    <box class="hub-stat media-box" orientation={V} spacing={8}>
      <box spacing={10} valign={Gtk.Align.CENTER}>
        <label class="stat-icon media-icon" label="󰎈" valign={Gtk.Align.CENTER} />
        <box orientation={V} spacing={1} hexpand={true}>
          <label class="media-title" label={titleText} halign={Gtk.Align.START} />
          <label class="media-artist" label={artistText} halign={Gtk.Align.START} />
        </box>
      </box>
      <box spacing={14} halign={Gtk.Align.CENTER} class="media-controls">
        <button
          class="media-btn"
          tooltipText="Música Anterior"
          onClicked={() => trySpawn("playerctl previous || playerctl -a previous")}
        >
          <label label="󰒮" />
        </button>
        <button
          class="media-btn play-btn"
          tooltipText="Play / Pause"
          onClicked={() => trySpawn("playerctl play-pause || playerctl -a play-pause")}
        >
          <label label={playIcon} />
        </button>
        <button
          class="media-btn"
          tooltipText="Próxima Música"
          onClicked={() => trySpawn("playerctl next || playerctl -a next")}
        >
          <label label="󰒭" />
        </button>
      </box>
    </box>
  )
}

function PowerMenu() {
  return (
    <box class="hub-power-menu" spacing={8} halign={Gtk.Align.START}>
      <button
        class="power-btn lock"
        tooltipText="Bloquear tela"
        onClicked={() => trySpawn("hyprlock")}
      >
        <label label="󰌾" />
      </button>
      <button
        class="power-btn suspend"
        tooltipText="Suspender"
        onClicked={() => trySpawn("systemctl suspend")}
      >
        <label label="󰤄" />
      </button>
      <button
        class="power-btn reboot"
        tooltipText="Reiniciar"
        onClicked={() => trySpawn("systemctl reboot")}
      >
        <label label="󰜉" />
      </button>
      <button
        class="power-btn shutdown"
        tooltipText="Desligar"
        onClicked={() => trySpawn("systemctl poweroff")}
      >
        <label label="󰐥" />
      </button>
    </box>
  )
}

function Divider() {
  return <box class="hub-divider" />
}

function Section({ title, children }: { title?: string; children: any }) {
  return (
    <box class="hub-section" orientation={V} spacing={title ? 12 : 0}>
      {title && (
        <label class="hub-section-title" label={title} halign={Gtk.Align.START} />
      )}
      {children}
    </box>
  )
}

export function Hub(monitor = 0) {
  const { LEFT, TOP, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      name="hud"
      visible={false}
      class="Hub"
      monitor={monitor}
      application={app}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={LEFT | TOP | BOTTOM}
      layer={Astal.Layer.OVERLAY}
    >
      <box class="hub-inner" orientation={V}>

        <Section>
          <box orientation={V} spacing={8}>
            <Clock />
            <ActiveWindow />
            <PowerMenu />
          </box>
        </Section>

        <Divider />

        <Section title="WORKSPACES">
          <Workspaces />
        </Section>

        <Divider />

        <Section title="MÍDIA">
          <Media />
        </Section>

        <Divider />

        <Section title="RECURSOS">
          <SystemStats />
        </Section>

        <Divider />

        <Section title="CONTROLE">
          <box orientation={V} spacing={8}>
            <Volume />
            <Brightness />
            <BatteryWidget />
            <NetworkWidget />
          </box>
        </Section>

      </box>
    </window>
  )
}

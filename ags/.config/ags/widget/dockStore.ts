import GLib from "gi://GLib"
import Gio from "gi://Gio"

export interface DockApp {
  id: string
  name: string
  cmd: string
  icon: string
  className: string
  color: string
  matchRegex: string
}

export interface DesktopApp {
  id: string
  name: string
  cmd: string
  icon: string
  comment: string
}

const DOCK_JSON_PATH = `${GLib.get_home_dir()}/.config/ags/dock-apps.json`

export const DEFAULT_DOCK_APPS: DockApp[] = [
  { id: "alacritty", name: "Terminal", cmd: "alacritty", icon: "Alacritty", className: "alacritty", color: "#38bdf8", matchRegex: "alacritty" },
  { id: "helium", name: "Helium", cmd: "helium-browser", icon: "helium-browser", className: "helium", color: "#fb923c", matchRegex: "helium|chrome|brave|firefox" },
  { id: "nvim", name: "Neovim", cmd: "alacritty -e nvim", icon: "nvim", className: "nvim", color: "#4ade80", matchRegex: "nvim|neovim" },
  { id: "nautilus", name: "Arquivos", cmd: "uwsm-app -- nautilus --new-window", icon: "org.gnome.Nautilus", className: "nautilus", color: "#60a5fa", matchRegex: "nautilus" },
  { id: "dbeaver", name: "DBeaver", cmd: "dbeaver", icon: "dbeaver", className: "dbeaver", color: "#c084fc", matchRegex: "dbeaver" },
  { id: "insomnia", name: "Insomnia", cmd: "insomnia", icon: "insomnia", className: "insomnia", color: "#f472b6", matchRegex: "insomnia" },
  { id: "lazygit", name: "LazyGit", cmd: "/home/caio/.config/hypr/scripts/term-run.sh 'lazygit'", icon: "/home/caio/.local/share/icons/hicolor/48x48/apps/GitHub.png", className: "lazygit", color: "#fb7185", matchRegex: "lazygit" },
  { id: "lazydocker", name: "LazyDocker", cmd: "/home/caio/.config/hypr/scripts/term-run.sh 'lazydocker'", icon: "/home/caio/.local/share/icons/hicolor/48x48/apps/Docker.png", className: "lazydocker", color: "#38bdf8", matchRegex: "lazydocker" },
  { id: "btop", name: "Btop", cmd: "/home/caio/.config/hypr/scripts/term-run.sh 'btop'", icon: "btop", className: "btop", color: "#facc15", matchRegex: "btop" },
  { id: "opencode", name: "OpenCode", cmd: "/home/caio/.config/hypr/scripts/term-run.sh 'opencode'", icon: "antigravity", className: "opencode", color: "#d8b4fe", matchRegex: "opencode" },
]

type Listener = (apps: DockApp[]) => void
const listeners: Set<Listener> = new Set()
let currentDockApps: DockApp[] | null = null

function readDockJson(): DockApp[] {
  try {
    const file = Gio.File.new_for_path(DOCK_JSON_PATH)
    if (!file.query_exists(null)) {
      writeDockJson(DEFAULT_DOCK_APPS)
      return [...DEFAULT_DOCK_APPS]
    }
    const [ok, contents] = file.load_contents(null)
    if (!ok || !contents) return [...DEFAULT_DOCK_APPS]
    const parsed = JSON.parse(new TextDecoder().decode(contents))
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch (err) {
    console.error("Falha ao ler dock-apps.json:", err)
  }
  return [...DEFAULT_DOCK_APPS]
}

function writeDockJson(apps: DockApp[]): void {
  try {
    const file = Gio.File.new_for_path(DOCK_JSON_PATH)
    const data = JSON.stringify(apps, null, 2)
    file.replace_contents(data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null)
  } catch (err) {
    console.error("Falha ao salvar dock-apps.json:", err)
  }
}

function notify(): void {
  const apps = getDockApps()
  listeners.forEach((fn) => {
    try {
      fn(apps)
    } catch (e) {
      console.error("Erro em dock listener:", e)
    }
  })
}

export function subscribeDockApps(fn: Listener): () => void {
  listeners.add(fn)
  fn(getDockApps())
  return () => listeners.delete(fn)
}

export function getDockApps(): DockApp[] {
  if (!currentDockApps) currentDockApps = readDockJson()
  return currentDockApps
}

export function addDockApp(item: Omit<DockApp, "id"> & { id?: string }): void {
  const apps = [...getDockApps()]
  const id = item.id || `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const newApp: DockApp = { ...item, id }
  apps.push(newApp)
  currentDockApps = apps
  writeDockJson(apps)
  notify()
}

export function removeDockApp(id: string): void {
  const apps = getDockApps().filter((a) => a.id !== id)
  currentDockApps = apps
  writeDockJson(apps)
  notify()
}

export function reorderDockApps(fromIndex: number, toIndex: number): void {
  const apps = [...getDockApps()]
  if (fromIndex < 0 || fromIndex >= apps.length || toIndex < 0 || toIndex >= apps.length) return
  const [moved] = apps.splice(fromIndex, 1)
  apps.splice(toIndex, 0, moved)
  currentDockApps = apps
  writeDockJson(apps)
  notify()
}

// Lê NoDisplay/Hidden do grupo Desktop Entry
function isHiddenEntry(keyFile: GLib.KeyFile): boolean {
  for (const key of ["NoDisplay", "Hidden"]) {
    try {
      if (keyFile.get_boolean("Desktop Entry", key)) return true
    } catch {}
  }
  return false
}

function isHiddenDesktopFile(path: string): boolean {
  try {
    const keyFile = new GLib.KeyFile()
    if (!keyFile.load_from_file(path, GLib.KeyFileFlags.NONE)) return false
    return keyFile.has_group("Desktop Entry") && isHiddenEntry(keyFile)
  } catch {
    return false
  }
}

function parseDesktopFile(path: string): DesktopApp | null {
  try {
    const keyFile = new GLib.KeyFile()
    if (!keyFile.load_from_file(path, GLib.KeyFileFlags.NONE)) return null
    if (!keyFile.has_group("Desktop Entry")) return null
    if (isHiddenEntry(keyFile)) return null

    let name = ""
    try {
      name = keyFile.get_locale_string("Desktop Entry", "Name", null)
    } catch {
      try {
        name = keyFile.get_string("Desktop Entry", "Name")
      } catch {}
    }

    let exec = ""
    try {
      exec = keyFile.get_string("Desktop Entry", "Exec")
    } catch {}

    if (!name || !exec) return null
    exec = exec.replace(/%[fFuUick]/g, "").trim()

    let icon = "application-x-executable"
    try {
      icon = keyFile.get_string("Desktop Entry", "Icon")
    } catch {}

    let comment = ""
    try {
      comment = keyFile.get_locale_string("Desktop Entry", "Comment", null)
    } catch {}

    const baseId = GLib.path_get_basename(path).replace(/\.desktop$/, "")
    return { id: baseId, name, cmd: exec, icon, comment }
  } catch {
    return null
  }
}

function scanDir(dirPath: string, appMap: Map<string, DesktopApp>, blocked: Set<string>): void {
  const dir = Gio.File.new_for_path(dirPath)
  if (!dir.query_exists(null)) return

  try {
    const enumerator = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null)
    let info = enumerator.next_file(null)
    while (info) {
      const name = info.get_name()
      if (name.endsWith(".desktop")) {
        const fullPath = `${dirPath}/${name}`
        const baseId = name.replace(/\.desktop$/, "")
        if (blocked.has(baseId) || appMap.has(baseId)) {
          info = enumerator.next_file(null)
          continue
        }
        if (isHiddenDesktopFile(fullPath)) {
          blocked.add(baseId)
        } else {
          const app = parseDesktopFile(fullPath)
          if (app) appMap.set(app.id, app)
          else blocked.add(baseId)
        }
      }
      info = enumerator.next_file(null)
    }
  } catch (err) {
    console.error(`Erro ao escanear diretório ${dirPath}:`, err)
  }
}

export function scanSystemApps(): DesktopApp[] {
  const map = new Map<string, DesktopApp>()
  // IDs ocultos (NoDisplay/Hidden) que não podem ser readicionados por diretórios posteriores
  const blocked = new Set<string>()

  try {
    const allApps = Gio.AppInfo.get_all()
    for (const app of allApps) {
      const name = app.get_display_name() || app.get_name()
      const appId = app.get_id()
      const id = appId ? appId.replace(/\.desktop$/, "") : name.toLowerCase().replace(/\s+/g, "-")
      if (!app.should_show()) {
        blocked.add(id)
        continue
      }
      let exec = app.get_executable() || ""
      if (!name || !exec) continue

      const gicon = app.get_icon()
      let icon = "application-x-executable"
      if (gicon) {
        icon = gicon.to_string() ?? icon
      }

      const comment = app.get_description() || ""

      map.set(id, { id, name, cmd: exec, icon, comment })
    }
  } catch (err) {
    console.error("Erro ao listar apps via Gio.AppInfo:", err)
  }

  // Complementa com escaneamento direto de diretórios para garantir apps locais sem desktop-database atualizado
  const userDir = `${GLib.get_home_dir()}/.local/share/applications`
  const sysDir = "/usr/share/applications"
  scanDir(userDir, map, blocked)
  scanDir(sysDir, map, blocked)

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

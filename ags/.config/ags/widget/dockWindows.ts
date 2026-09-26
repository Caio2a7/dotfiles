import GioUnix from "gi://GioUnix"
import Hyprland from "gi://AstalHyprland"
import type { DockApp } from "./dockStore"

// Casamento app do dock <-> janelas do Hyprland, com cache por app (.desktop lido uma única vez)
interface MatchKeys {
  exact: Set<string>
  fuzzy: string
}

const keyCache = new Map<string, MatchKeys>()
const CMD_WRAPPERS = new Set(["flatpak", "uwsm-app", "uwsm", "env", "sh", "bash", "omarchy-launch-webapp"])

const norm = (s: string | null | undefined): string => (s ?? "").toLowerCase()

function lastSegment(id: string): string {
  const parts = id.split(".")
  return parts[parts.length - 1]
}

function firstToken(app: DockApp): string {
  return norm((app.matchRegex || app.name).split("|")[0]).replace(/[^a-z0-9._-]/g, "")
}

// Primeiro executável do comando que não seja um wrapper genérico (flatpak, uwsm-app...)
function cmdBasename(cmd: string): string {
  const words = cmd.trim().split(/\s+/)
  for (const w of words) {
    const base = norm(w.split("/").pop())
    if (base && !base.startsWith("-") && !CMD_WRAPPERS.has(base)) return base
  }
  return ""
}

function desktopWmClass(desktopId: string): string {
  if (!desktopId) return ""
  try {
    const info = GioUnix.DesktopAppInfo.new(`${desktopId}.desktop`)
    return norm(info?.get_startup_wm_class())
  } catch (err) {
    console.error("Falha ao ler .desktop de", desktopId, err)
    return ""
  }
}

function buildKeys(app: DockApp): MatchKeys {
  const token = firstToken(app)
  const candidates = [app.id, lastSegment(app.id), token, lastSegment(token), cmdBasename(app.cmd)]
  const exact = new Set(candidates.map(norm).filter(Boolean))
  for (const id of [app.id, token]) {
    const wm = desktopWmClass(id)
    if (wm) exact.add(wm)
  }
  return { exact, fuzzy: token.length >= 4 ? token : "" }
}

function getKeys(app: DockApp): MatchKeys {
  const cacheKey = `${app.id}|${app.cmd}|${app.matchRegex}`
  let keys = keyCache.get(cacheKey)
  if (!keys) {
    keys = buildKeys(app)
    keyCache.set(cacheKey, keys)
  }
  return keys
}

function ordered(a: Hyprland.Client, b: Hyprland.Client): number {
  return a.workspace.id - b.workspace.id || a.address.localeCompare(b.address)
}

// Janelas do app em ordem estável (workspace, endereço); match exato primeiro, substring como fallback
export function windowsFor(app: DockApp, clients: Hyprland.Client[]): Hyprland.Client[] {
  const keys = getKeys(app)
  const classes = (c: Hyprland.Client) => [norm(c.class), norm(c.initialClass)]
  let found = clients.filter((c) => classes(c).some((k) => keys.exact.has(k)))
  if (found.length === 0 && keys.fuzzy) {
    found = clients.filter((c) => classes(c).some((k) => k.includes(keys.fuzzy)))
  }
  return found.sort(ordered)
}

export function isFocusedApp(wins: Hyprland.Client[], focused: Hyprland.Client | null): boolean {
  return !!focused && wins.some((w) => w.address === focused.address)
}

// Próxima janela do ciclo: a seguinte à focada (com wrap) ou a primeira se nenhuma está focada
export function nextWindow(wins: Hyprland.Client[], focused: Hyprland.Client | null): Hyprland.Client {
  const idx = focused ? wins.findIndex((w) => w.address === focused.address) : -1
  return wins[(idx + 1) % wins.length]
}

// Foca (ou cicla) as janelas do app; retorna false se não há janela e o chamador deve lançar o app
export function focusOrCycle(app: DockApp, hypr: Hyprland.Hyprland): boolean {
  const wins = windowsFor(app, hypr.clients ?? [])
  if (wins.length === 0) return false
  nextWindow(wins, hypr.focusedClient ?? null).focus()
  return true
}

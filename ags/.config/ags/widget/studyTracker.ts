import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { ContractState, StudyState, parseContract } from "./studyState"
import { findVaultRoot, logOnce, readNote, scanStudyDir } from "./studyFrontmatter"

export { initials } from "./studyState"
export type { StudyState } from "./studyState"

// Fonte primária: arquivo de estado publicado pelo Obsidian (Gio.FileMonitor, ~ms).
// Secundária: frontmatter das notas (rescan ~30s) para ausência/estado preso.
const HOME = GLib.get_home_dir()
const STUDY_DIR = GLib.getenv("OCQ_STUDY_DIR") || `${HOME}/Vida/00 - MATÉRIAS/Matérias`
const ENV_FILE = GLib.getenv("LIFEOS_TRACKING_FILE")
const STATE_FILES = ENV_FILE ? [ENV_FILE] : [`${HOME}/.cache/lifeos/tracking.json`, `${HOME}/Vida/.obsidian/lifeos-tracking.json`]
const VAULT_ROOT = findVaultRoot(STUDY_DIR) ?? `${HOME}/Vida`
const DEBOUNCE_MS = 25
const RESCAN_SECONDS = 30
const STUCK_GRACE_MS = 2000

type Listener = (state: StudyState) => void

const listeners = new Set<Listener>()
const errs = new Set<string>()
let current: StudyState = { active: false }
let fileState: ContractState | null = null
let fmState: StudyState = { active: false }
let stale = false
let started = false
let seq = 0
let debounceId = 0

const decoder = new TextDecoder()

function readContract(path: string): ContractState | null {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok) return null
    const parsed = parseContract(decoder.decode(bytes), VAULT_ROOT)
    if (!parsed) logOnce(errs, `Estado de tracking inválido/parcial: ${path}`, "ignorado")
    return parsed
  } catch (err) {
    if (!(err instanceof GLib.Error && err.matches(GLib.file_error_quark(), GLib.FileError.NOENT))) {
      logOnce(errs, `Falha ao ler ${path}`, err)
    }
    return null
  }
}

// Mais recente por updatedAt; arquivo inválido é ignorado (mantém o outro)
function loadContract(): ContractState | null {
  let best: ContractState | null = null
  for (const p of STATE_FILES) {
    const c = readContract(p)
    if (c && (!best || c.updatedAt > best.updatedAt)) best = c
  }
  return best
}

function resolve(): StudyState {
  return !fileState || stale ? fmState : fileState.state
}

function publish(): void {
  const next = resolve()
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  listeners.forEach((fn) => fn(current))
}

function reloadContract(): void {
  const next = loadContract()
  // Arquivo inválido/ausente após já termos estado válido: mantém o anterior, exceto se sumiu de vez
  if (next || !STATE_FILES.some((p) => GLib.file_test(p, GLib.FileTest.EXISTS))) {
    if (JSON.stringify(next) !== JSON.stringify(fileState)) stale = false
    fileState = next
  }
  publish()
}

// Estado preso: arquivo diverge da nota e a nota foi modificada depois do updatedAt
async function detectStale(fs: ContractState, fm: { state: StudyState; mtimeMs: number }): Promise<boolean> {
  if (!fs.state.active) return fm.state.active && fm.mtimeMs > fs.updatedAt + STUCK_GRACE_MS
  try {
    const note = await readNote(fs.state.file)
    return note.fm.tracking_ativo !== "true" && note.mtimeMs > fs.updatedAt + STUCK_GRACE_MS
  } catch (err) {
    logOnce(errs, `Falha ao ler nota ${fs.state.file}`, err)
    return false
  }
}

async function rescan(): Promise<void> {
  const my = ++seq
  const scan = await scanStudyDir(STUDY_DIR, errs)
  if (my !== seq) return
  const contract = loadContract() ?? fileState
  fmState = scan.state
  stale = contract ? await detectStale(contract, scan) : false
  if (my !== seq) return
  if (contract) fileState = contract
  publish()
}

function scheduleReload(): void {
  if (debounceId) GLib.source_remove(debounceId)
  debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
    debounceId = 0
    reloadContract()
    return GLib.SOURCE_REMOVE
  })
}

function watchStateDirs(): void {
  const names = new Set(STATE_FILES.map((p) => GLib.path_get_basename(p)))
  const dirs = new Set(STATE_FILES.map((p) => GLib.path_get_dirname(p)))
  for (const dir of dirs) {
    try {
      GLib.mkdir_with_parents(dir, 0o755)
      const mon = Gio.File.new_for_path(dir).monitor_directory(Gio.FileMonitorFlags.NONE, null)
      mon.connect("changed", (_m, file, other) => {
        const hit = [file, other].some((f) => f && names.has(f.get_basename() ?? ""))
        if (hit) scheduleReload()
      })
    } catch (err) {
      logOnce(errs, `Monitor indisponível: ${dir}`, err)
    }
  }
}

function start(): void {
  started = true
  fileState = loadContract()
  watchStateDirs()
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, RESCAN_SECONDS, () => {
    rescan().catch((e) => logOnce(errs, "Falha no rescan de estudo", e))
    return GLib.SOURCE_CONTINUE
  })
  publish()
  rescan().catch((e) => logOnce(errs, "Falha no rescan de estudo", e))
}

export function subscribeStudy(fn: Listener): () => void {
  listeners.add(fn)
  fn(current)
  if (!started) start()
  return () => listeners.delete(fn)
}

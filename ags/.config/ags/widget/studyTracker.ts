import Gio from "gi://Gio"
import GLib from "gi://GLib"

// Leitura (somente leitura!) das notas de matérias do Obsidian para o anel de foco do dock
Gio._promisify(Gio.File.prototype, "enumerate_children_async", "enumerate_children_finish")
Gio._promisify(Gio.File.prototype, "load_contents_async", "load_contents_finish")

const DEFAULT_DIR = `${GLib.get_home_dir()}/Vida/00 - MATÉRIAS/Matérias`
const STUDY_DIR = GLib.getenv("OCQ_STUDY_DIR") || DEFAULT_DIR
const DEBOUNCE_MS = 300
const RESCAN_SECONDS = 15

export type StudyState =
  | { active: false }
  | {
      active: true
      materia: string
      file: string
      vault: string
      relPath: string
      inicioMs: number
      gastoMin: number
      estimadoMin: number
    }

type Listener = (state: StudyState) => void

// Extrai só o bloco de frontmatter (entre os dois primeiros "---"), linhas simples "chave: valor"
export function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  const out: Record<string, string> = {}
  if (lines[0]?.trim() !== "---") return out
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") return out
    const m = line.match(/^([\w-]+):\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2")
  }
  return {}
}

const STOPWORDS = new Set(["e", "de", "da", "do", "das", "dos", "a", "o", "em", "para", "ou", "&", "-"])

// "Cálculo Diferencial e Integral" -> "CDI"; palavra única -> primeiras 4 letras
export function initials(name: string): string {
  const base = name.split(" - ")[0]
  const words = base.split(/\s+/).filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
  if (words.length === 0) return base.slice(0, 4).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.slice(0, 4).map((w) => w[0].toUpperCase()).join("")
}

const num = (v: string | undefined): number => {
  const n = parseFloat(v ?? "")
  return Number.isFinite(n) ? n : 0
}

// Sobe a partir da pasta até achar `.obsidian` (raiz do vault)
export function findVaultRoot(dir: string): string | null {
  let cur = dir
  while (cur && cur !== "/") {
    if (GLib.file_test(`${cur}/.obsidian`, GLib.FileTest.IS_DIR)) return cur
    cur = GLib.path_get_dirname(cur)
  }
  return null
}

export function toState(path: string, fm: Record<string, string>): StudyState {
  if (fm.tracking_ativo !== "true") return { active: false }
  const stem = GLib.path_get_basename(path).replace(/\.md$/, "")
  const root = findVaultRoot(GLib.path_get_dirname(path))
  return {
    active: true,
    materia: fm.materia || stem,
    file: path,
    vault: root ? GLib.path_get_basename(root) : "",
    relPath: root ? path.slice(root.length + 1).replace(/\.md$/, "") : stem,
    inicioMs: num(fm.tracking_inicio),
    // tempo_gasto_direto é o acumulado da própria matéria; subtarefas usam tempo_gasto
    gastoMin: num(fm.tempo_gasto_direto) || num(fm.tempo_gasto),
    estimadoMin: num(fm.tempo_estimado),
  }
}

const decoder = new TextDecoder()
const loggedErrors = new Set<string>()

function logOnce(msg: string, err: unknown): void {
  if (loggedErrors.has(msg)) return
  loggedErrors.add(msg)
  console.error(msg, err)
}

async function listMarkdown(dir: Gio.File): Promise<string[]> {
  const en = (await (dir as any).enumerate_children_async("standard::name", Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null)) as Gio.FileEnumerator
  const names: string[] = []
  for (let info = en.next_file(null); info; info = en.next_file(null)) {
    if (info.get_name().endsWith(".md")) names.push(info.get_name())
  }
  return names
}

async function readState(path: string): Promise<StudyState> {
  try {
    const [bytes] = (await (Gio.File.new_for_path(path) as any).load_contents_async(null)) as [Uint8Array, string]
    return toState(path, parseFrontmatter(decoder.decode(bytes)))
  } catch (err) {
    logOnce(`Falha ao ler nota ${path}`, err)
    return { active: false }
  }
}

export async function scanStudyDir(dirPath: string): Promise<StudyState> {
  try {
    const names = await listMarkdown(Gio.File.new_for_path(dirPath))
    const states = await Promise.all(names.map((n) => readState(`${dirPath}/${n}`)))
    return states.find((s) => s.active) ?? { active: false }
  } catch (err) {
    logOnce(`Pasta de matérias indisponível: ${dirPath}`, err)
    return { active: false }
  }
}

// --- Store: monitor de diretório (debounce) + rescan de segurança ---
const listeners = new Set<Listener>()
let current: StudyState = { active: false }
let started = false
let scanSeq = 0
let debounceId = 0

async function rescan(): Promise<void> {
  const seq = ++scanSeq
  const next = await scanStudyDir(STUDY_DIR)
  if (seq !== scanSeq) return // varredura mais nova já em andamento
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  listeners.forEach((fn) => fn(current))
}

function scheduleRescan(): void {
  if (debounceId) GLib.source_remove(debounceId)
  debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
    debounceId = 0
    rescan().catch((e) => logOnce("Falha no rescan de estudo", e))
    return GLib.SOURCE_REMOVE
  })
}

function start(): void {
  started = true
  try {
    const monitor = Gio.File.new_for_path(STUDY_DIR).monitor_directory(Gio.FileMonitorFlags.NONE, null)
    monitor.connect("changed", scheduleRescan)
  } catch (err) {
    logOnce("Monitor da pasta de matérias indisponível", err)
  }
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, RESCAN_SECONDS, () => {
    scheduleRescan()
    return GLib.SOURCE_CONTINUE
  })
  scheduleRescan()
}

export function subscribeStudy(fn: Listener): () => void {
  listeners.add(fn)
  fn(current)
  if (!started) start()
  return () => listeners.delete(fn)
}

import Gio from "gi://Gio"
import GLib from "gi://GLib"
import type { StudyState } from "./studyState"

// Fonte secundária: varredura recursiva (somente leitura) do frontmatter das notas de matérias
Gio._promisify(Gio.File.prototype, "enumerate_children_async", "enumerate_children_finish")
Gio._promisify(Gio.File.prototype, "load_contents_async", "load_contents_finish")

const decoder = new TextDecoder()

export type NoteInfo = { fm: Record<string, string>; mtimeMs: number }
export type ScanResult = { state: StudyState; mtimeMs: number }

export function logOnce(set: Set<string>, msg: string, err: unknown): void {
  if (set.has(msg)) return
  set.add(msg)
  console.error(msg, err)
}

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

export async function readNote(path: string): Promise<NoteInfo> {
  const file = Gio.File.new_for_path(path)
  const [bytes] = (await (file as any).load_contents_async(null)) as [Uint8Array, string]
  const info = file.query_info("time::modified,time::modified-usec", Gio.FileQueryInfoFlags.NONE, null)
  const mtimeMs = info.get_modification_date_time()?.to_unix() ?? 0
  return { fm: parseFrontmatter(decoder.decode(bytes)), mtimeMs: mtimeMs * 1000 }
}

async function listMarkdown(dir: string, out: string[], errs: Set<string>): Promise<void> {
  const en = (await (Gio.File.new_for_path(dir) as any).enumerate_children_async(
    "standard::name,standard::type",
    Gio.FileQueryInfoFlags.NONE,
    GLib.PRIORITY_DEFAULT,
    null,
  )) as Gio.FileEnumerator
  const subdirs: string[] = []
  for (let info = en.next_file(null); info; info = en.next_file(null)) {
    const name = info.get_name()
    if (name.startsWith(".")) continue
    if (info.get_file_type() === Gio.FileType.DIRECTORY) subdirs.push(`${dir}/${name}`)
    else if (name.endsWith(".md")) out.push(`${dir}/${name}`)
  }
  for (const sub of subdirs) {
    await listMarkdown(sub, out, errs).catch((e) => logOnce(errs, `Pasta ilegível: ${sub}`, e))
  }
}

export async function scanStudyDir(dir: string, errs: Set<string>): Promise<ScanResult> {
  const inactive: ScanResult = { state: { active: false }, mtimeMs: 0 }
  const paths: string[] = []
  try {
    await listMarkdown(dir, paths, errs)
  } catch (err) {
    logOnce(errs, `Pasta de matérias indisponível: ${dir}`, err)
    return inactive
  }
  const notes = await Promise.all(
    paths.map((p) =>
      readNote(p).then(
        (n) => ({ p, n }),
        (e) => (logOnce(errs, `Falha ao ler nota ${p}`, e), null),
      ),
    ),
  )
  for (const item of notes) {
    if (!item) continue
    const state = toState(item.p, item.n.fm)
    if (state.active) return { state, mtimeMs: item.n.mtimeMs }
  }
  return inactive
}

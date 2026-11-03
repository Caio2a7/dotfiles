import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { Config, DiaInfo, Estado, Habito, Mapa, Resumo, estadoDia, fold, hojeISO, parseConfig, parseLog, resumo } from "./habitsCore"
import { AddInput, SetInput, montarAdd, montarSet } from "./habitsWrite"

// Fonte única de verdade: arquivos do vault (config + log append-only), monitorados com Gio.FileMonitor
const HOME = GLib.get_home_dir()
const DATA_DIR = GLib.getenv("OCQ_HABITS_DIR") || `${HOME}/Vida/Scripts/data`
const CONFIG_FILE = `${DATA_DIR}/habitos_config.json`
const LOG_FILE = `${DATA_DIR}/habitos.jsonl`
const DEBOUNCE_MS = 25
const TICK_SECONDS = 30

export interface HabitsState {
  config: Config | null
  erro: string | null
  mapa: Mapa
  hoje: string
  noiteAtiva: boolean // passou do lembrete da noite (ex.: 21:30)
  invalidas: number
}

export interface HabitRow {
  hab: Habito
  dia: DiaInfo
  resumo: Resumo
}

type Listener = (s: HabitsState) => void

const listeners = new Set<Listener>()
const decoder = new TextDecoder()
const encoder = new TextEncoder()
let config: Config | null = null
let erro: string | null = null
let mapa: Mapa = new Map()
let invalidas = 0
let current: HabitsState = { config: null, erro: null, mapa, hoje: hojeISO(), noiteAtiva: false, invalidas: 0 }
let started = false
let debounceId = 0

function readText(path: string): string | null {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    return ok ? decoder.decode(bytes) : null
  } catch (err) {
    if (err instanceof GLib.Error && err.matches(GLib.file_error_quark(), GLib.FileError.NOENT)) return null
    throw err
  }
}

function reloadData(): void {
  try {
    const cfgText = readText(CONFIG_FILE)
    if (cfgText === null) throw new Error(`config ausente: ${CONFIG_FILE}`)
    config = parseConfig(cfgText)
    const parsed = parseLog(readText(LOG_FILE) ?? "")
    mapa = fold(parsed.eventos)
    invalidas = parsed.invalidas
    erro = null
  } catch (err) {
    erro = err instanceof Error ? err.message : String(err)
    console.error("Hábitos:", erro)
  }
}

function passouDaNoite(now: Date): boolean {
  if (!config) return false
  const [h, m] = config.lembretes.noite.split(":").map(Number)
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m
}

function publish(force = false): void {
  const now = new Date()
  const next: HabitsState = { config, erro, mapa, hoje: hojeISO(now), noiteAtiva: passouDaNoite(now), invalidas }
  const same = current.hoje === next.hoje && current.noiteAtiva === next.noiteAtiva
  if (!force && same) return
  current = next
  listeners.forEach((fn) => fn(current))
}

function scheduleReload(): void {
  if (debounceId) GLib.source_remove(debounceId)
  debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
    debounceId = 0
    reloadData()
    publish(true)
    return GLib.SOURCE_REMOVE
  })
}

function watchDataDir(): void {
  const names = new Set([GLib.path_get_basename(CONFIG_FILE), GLib.path_get_basename(LOG_FILE)])
  try {
    GLib.mkdir_with_parents(DATA_DIR, 0o755)
    const mon = Gio.File.new_for_path(DATA_DIR).monitor_directory(Gio.FileMonitorFlags.NONE, null)
    mon.connect("changed", (_m, file, other) => {
      if ([file, other].some((f) => f && names.has(f.get_basename() ?? ""))) scheduleReload()
    })
  } catch (err) {
    console.error("Hábitos: monitor indisponível:", DATA_DIR, err)
  }
}

function start(): void {
  started = true
  reloadData()
  watchDataDir()
  // Rollover à meia-noite e virada do horário do lembrete
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, TICK_SECONDS, () => {
    publish()
    return GLib.SOURCE_CONTINUE
  })
  publish(true)
}

export function subscribeHabits(fn: Listener): () => void {
  listeners.add(fn)
  if (!started) start()
  fn(current)
  return () => listeners.delete(fn)
}

export function rowsOf(s: HabitsState): HabitRow[] {
  if (!s.config) return []
  return s.config.habitos.map((hab) => ({ hab, dia: estadoDia(hab, s.mapa, s.hoje, s.hoje), resumo: resumo(hab, s.mapa, s.hoje) }))
}

export const isPendente = (r: HabitRow): boolean => r.dia.estado === "pendente"

// Alerta âmbar: "não falhe duas vezes" ou passou do lembrete da noite com pendentes
export function temAlerta(s: HabitsState, rows: HabitRow[]): boolean {
  return rows.some((r) => r.resumo.naoFalheDuasVezes) || (s.noiteAtiva && rows.some(isPendente))
}

function anexar(evento: object): void {
  GLib.mkdir_with_parents(DATA_DIR, 0o755)
  const stream = Gio.File.new_for_path(LOG_FILE).append_to(Gio.FileCreateFlags.NONE, null)
  try {
    stream.write_all(encoder.encode(JSON.stringify(evento) + "\n"), null)
  } finally {
    stream.close(null)
  }
  reloadData()
  publish(true)
}

function cfgOuErro(): Config {
  if (!config) throw new Error(`habitos: config indisponível${erro ? ` (${erro})` : ""}`)
  return config
}

// Define/limpa o dia (s,v,n nulos = limpar). Datas locais; src "ags"
export function registrar(i: { h: string; s?: Estado | null; v?: number | null; n?: string | null; d?: string }): void {
  const input: SetInput = { ...i, d: i.d ?? hojeISO(), src: "ags" }
  anexar(montarSet(cfgOuErro(), input))
}

export function somar(i: { h: string; v: number; d?: string }): void {
  const input: AddInput = { ...i, d: i.d ?? hojeISO(), src: "ags" }
  anexar(montarAdd(cfgOuErro(), input))
}

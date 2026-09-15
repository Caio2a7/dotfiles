import GLib from "gi://GLib"

const VITTAE_DIR = `${GLib.get_home_dir()}/vittae`
export const METAS_FILE = `${VITTAE_DIR}/metas_semana.json`
export const REGISTROS_FILE = `${VITTAE_DIR}/registros.csv`
export const CRONOGRAMA_FILE = `${VITTAE_DIR}/cronograma.csv`

export type TopicoCategoria = "constante" | "volatil"

export interface TopicoMeta {
  id: string
  nome: string
  categoria: TopicoCategoria
  dia_importante: number | null // 0=Segunda, 1=Terça, ..., 6=Domingo
  horas_meta: number
  cor: string
  icon: string
}

export interface MetasData {
  topicos: TopicoMeta[]
}

export interface AllocatedSlot {
  topico: TopicoMeta | null
  nome: string
  cor: string
  icon: string
  isCustomStudy: boolean
}

export interface TopicoProgresso {
  id: string
  nome: string
  categoria: TopicoCategoria
  dia_importante: number | null
  horas_meta: number
  horas_alocadas: number
  horas_feitas: number
  cor: string
  icon: string
}

export interface ScheduleAllocationResult {
  // Mapa de chave "rowIdx-dayIdx" para a atividade alocada
  slotMap: Map<string, AllocatedSlot>
  progressoTopicos: TopicoProgresso[]
  totalHorasDisponiveis: number
  totalHorasPlanejadas: number
}

function readFile(path: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok) return ""
    return new TextDecoder().decode(bytes)
  } catch {
    return ""
  }
}

function writeFile(path: string, content: string): boolean {
  try {
    return GLib.file_set_contents(path, content)
  } catch (e) {
    console.error(`Erro ao gravar ${path}:`, e)
    return false
  }
}

export function readMetas(): MetasData {
  try {
    const raw = readFile(METAS_FILE)
    if (!raw) return { topicos: [] }
    return JSON.parse(raw) as MetasData
  } catch (e) {
    console.error("Erro ao ler metas_semana.json:", e)
    return { topicos: [] }
  }
}

export function saveMetas(data: MetasData): boolean {
  try {
    const jsonStr = JSON.stringify(data, null, 2)
    return writeFile(METAS_FILE, jsonStr)
  } catch (e) {
    console.error("Erro ao salvar metas_semana.json:", e)
    return false
  }
}

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0
  let h = 0
  let m = 0
  const hMatch = timeStr.match(/(\d+)\s*h/i)
  const mMatch = timeStr.match(/(\d+)\s*m/i)
  if (hMatch) h = parseInt(hMatch[1], 10)
  if (mMatch) m = parseInt(mMatch[1], 10)
  if (!hMatch && !mMatch) {
    const n = parseFloat(timeStr)
    if (!isNaN(n)) return n
  }
  return h + m / 60
}

function getMondayOfDate(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diffToMonday)
  date.setHours(0, 0, 0, 0)
  return date
}

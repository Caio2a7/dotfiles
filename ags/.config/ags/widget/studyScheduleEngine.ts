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

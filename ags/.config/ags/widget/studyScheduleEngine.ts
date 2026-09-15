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

export function readDoneHoursThisWeek(): Map<string, number> {
  const result = new Map<string, number>()
  try {
    const raw = readFile(REGISTROS_FILE)
    if (!raw) return result
    const lines = raw.split("\n")
    const currentMonday = getMondayOfDate(new Date()).getTime()
    const nextMonday = currentMonday + 7 * 24 * 60 * 60 * 1000

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(",")
      if (parts.length < 3) continue
      const dateStr = parts[0].trim()
      const topico = parts[1].trim()
      const timeStr = parts[2].trim()

      const dParts = dateStr.split("-").map(Number)
      if (dParts.length !== 3 || isNaN(dParts[0])) continue
      const sessionDate = new Date(dParts[0], dParts[1] - 1, dParts[2]).getTime()

      if (sessionDate >= currentMonday && sessionDate < nextMonday) {
        const h = parseTimeToHours(timeStr)
        const normKey = normalizeStr(topico)
        result.set(normKey, (result.get(normKey) || 0) + h)
      }
    }
  } catch (e) {
    console.error("Erro ao ler horas feitas no registros.csv:", e)
  }
  return result
}

export interface BaseScheduleSlot {
  rowIdx: number
  dayIdx: number // 0=Segunda ... 6=Domingo
  timeStr: string
  durationHours: number
}

export function parseScheduleStudySlots(): {
  slots: BaseScheduleSlot[]
  totalStudySlots: number
  allRows: Array<{ timeStr: string; startHour: number; endHour: number; activities: string[] }>
} {
  const raw = readFile(CRONOGRAMA_FILE)
  if (!raw) return { slots: [], totalStudySlots: 0, allRows: [] }

  const lines = raw.split("\n")
  const allRows: Array<{ timeStr: string; startHour: number; endHour: number; activities: string[] }> = []
  const studySlots: BaseScheduleSlot[] = []

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r].trim()
    if (!line) continue
    const parts = line.split(",")
    if (parts.length < 8) continue

    const timeStr = parts[0].trim()
    const activities = parts.slice(1, 8).map((p) => p.trim())

    const m = timeStr.match(/(\d+):00\s*-\s*(\d+):00/)
    let startHour = 0
    let endHour = 0
    if (m) {
      startHour = parseInt(m[1], 10)
      endHour = parseInt(m[2], 10)
    }

    let durationHours = 1
    if (endHour > startHour) {
      durationHours = endHour - startHour
    } else if (endHour < startHour && endHour > 0) {
      durationHours = 24 - startHour + endHour
    }

    allRows.push({ timeStr, startHour, endHour, activities })

    activities.forEach((act, dayIdx) => {
      const normAct = normalizeStr(act)
      if (normAct === "estudar" || normAct === "estudo") {
        studySlots.push({
          rowIdx: r - 1,
          dayIdx,
          timeStr,
          durationHours,
        })
      }
    })
  }

  return { slots: studySlots, totalStudySlots: studySlots.length, allRows }
}

/**
 * Algoritmo determinístico de alocação de estudos:
 * 1. Tópicos voláteis: prioridade máxima antes de dia_importante (limite máx 6h/dia).
 * 2. Tópicos constantes: distribuídos suavemente nos slots restantes (1h a 2h/dia).
 */
export function computeScheduleAllocation(
  metas: MetasData,
  studySlots: BaseScheduleSlot[],
  doneHoursMap: Map<string, number>
): ScheduleAllocationResult {
  const slotMap = new Map<string, AllocatedSlot>()
  const hoursAllocated = new Map<string, number>()
  const dailyHoursByTopic = new Map<string, Map<number, number>>()

  metas.topicos.forEach((t) => {
    hoursAllocated.set(t.id, 0)
    dailyHoursByTopic.set(t.id, new Map<number, number>())
  })

  // Ordenar slots cronologicamente: por dia (0..6) e depois por linha/hora (rowIdx)
  const sortedSlots = [...studySlots].sort((a, b) => {
    if (a.dayIdx !== b.dayIdx) return a.dayIdx - b.dayIdx
    return a.rowIdx - b.rowIdx
  })

  const occupiedSlots = new Set<string>()

  // 1. Tópicos Voláteis: Prioridade antes do dia importante
  const topicosVolateis = metas.topicos.filter((t) => t.categoria === "volatil" && t.horas_meta > 0)
  // Ordena voláteis pelos que têm prazo mais cedo
  topicosVolateis.sort((a, b) => (a.dia_importante ?? 7) - (b.dia_importante ?? 7))

  for (const topico of topicosVolateis) {
    let remaining = topico.horas_meta
    const deadlineDay = topico.dia_importante !== null ? topico.dia_importante : 6
    const topicoDays = dailyHoursByTopic.get(topico.id)!

    // Primeiro passo: alocar estritamente antes do dia_importante (dias 0 .. deadlineDay - 1)
    for (const slot of sortedSlots) {
      if (remaining <= 0) break
      const key = `${slot.rowIdx}-${slot.dayIdx}`
      if (occupiedSlots.has(key)) continue
      if (slot.dayIdx >= deadlineDay && deadlineDay > 0) continue

      const dayCurrentHours = topicoDays.get(slot.dayIdx) || 0
      if (dayCurrentHours + slot.durationHours > 6) continue // Limite max 6h/dia

      occupiedSlots.add(key)
      slotMap.set(key, {
        topico,
        nome: topico.nome,
        cor: topico.cor,
        icon: topico.icon,
        isCustomStudy: true,
      })

      remaining -= slot.durationHours
      hoursAllocated.set(topico.id, (hoursAllocated.get(topico.id) || 0) + slot.durationHours)
      topicoDays.set(slot.dayIdx, dayCurrentHours + slot.durationHours)
    }

    // Segundo passo de tolerância: se faltar horas e não coube tudo antes da prova, usa os dias restantes
    if (remaining > 0) {
      for (const slot of sortedSlots) {
        if (remaining <= 0) break
        const key = `${slot.rowIdx}-${slot.dayIdx}`
        if (occupiedSlots.has(key)) continue

        const dayCurrentHours = topicoDays.get(slot.dayIdx) || 0
        if (dayCurrentHours + slot.durationHours > 6) continue

        occupiedSlots.add(key)
        slotMap.set(key, {
          topico,
          nome: topico.nome,
          cor: topico.cor,
          icon: topico.icon,
          isCustomStudy: true,
        })

        remaining -= slot.durationHours
        hoursAllocated.set(topico.id, (hoursAllocated.get(topico.id) || 0) + slot.durationHours)
        topicoDays.set(slot.dayIdx, dayCurrentHours + slot.durationHours)
      }
    }
  }

  // 2. Tópicos Constantes: Distribuição equilibrada dia a dia (1h ou 2h)
  const topicosConstantes = metas.topicos.filter((t) => t.categoria === "constante" && t.horas_meta > 0)

  // Para equilibrar os constantes, fazemos rodadas round-robin pelos dias da semana
  let addedAnyInRound = true
  while (addedAnyInRound) {
    addedAnyInRound = false
    for (const topico of topicosConstantes) {
      const allocated = hoursAllocated.get(topico.id) || 0
      if (allocated >= topico.horas_meta) continue

      const topicoDays = dailyHoursByTopic.get(topico.id)!

      // Procura o melhor slot: prioriza dias onde este tópico constante ainda NÃO foi estudado hoje
      let bestSlot: BaseScheduleSlot | null = null
      let minTopicDayHours = 999

      for (const slot of sortedSlots) {
        const key = `${slot.rowIdx}-${slot.dayIdx}`
        if (occupiedSlots.has(key)) continue

        const dayHours = topicoDays.get(slot.dayIdx) || 0
        if (dayHours >= 2) continue // Constantes no máximo 2h por dia

        if (dayHours < minTopicDayHours) {
          minTopicDayHours = dayHours
          bestSlot = slot
        }
      }

      if (bestSlot) {
        const key = `${bestSlot.rowIdx}-${bestSlot.dayIdx}`
        occupiedSlots.add(key)
        slotMap.set(key, {
          topico,
          nome: topico.nome,
          cor: topico.cor,
          icon: topico.icon,
          isCustomStudy: true,
        })

        const prevDayH = topicoDays.get(bestSlot.dayIdx) || 0
        topicoDays.set(bestSlot.dayIdx, prevDayH + bestSlot.durationHours)
        hoursAllocated.set(topico.id, allocated + bestSlot.durationHours)
        addedAnyInRound = true
      }
    }
  }

  // 3. Slots não preenchidos: "Estudo Livre"
  for (const slot of sortedSlots) {
    const key = `${slot.rowIdx}-${slot.dayIdx}`
    if (!occupiedSlots.has(key)) {
      slotMap.set(key, {
        topico: null,
        nome: "Estudo Livre",
        cor: "#94a3b8",
        icon: "󰄲",
        isCustomStudy: true,
      })
    }
  }

  // Montar relatório de progresso dos tópicos
  const progressoTopicos: TopicoProgresso[] = metas.topicos.map((t) => {
    const normNome = normalizeStr(t.nome)
    const normId = normalizeStr(t.id)
    let feitas = 0
    for (const [key, val] of doneHoursMap.entries()) {
      if (key === normNome || key === normId || key.includes(normNome) || normNome.includes(key)) {
        feitas += val
      }
    }

    return {
      id: t.id,
      nome: t.nome,
      categoria: t.categoria,
      dia_importante: t.dia_importante,
      horas_meta: t.horas_meta,
      horas_alocadas: hoursAllocated.get(t.id) || 0,
      horas_feitas: Math.round(feitas * 10) / 10,
      cor: t.cor,
      icon: t.icon,
    }
  })

  const totalHorasDisponiveis = studySlots.reduce((acc, s) => acc + s.durationHours, 0)
  const totalHorasPlanejadas = metas.topicos.reduce((acc, t) => acc + t.horas_meta, 0)

  return {
    slotMap,
    progressoTopicos,
    totalHorasDisponiveis,
    totalHorasPlanejadas,
  }
}

import { addDias, dataValida, diasEntre, segundaDe } from "./habitsDates"
export { addDias, dataValida, diasEntre, hojeISO, segundaDe } from "./habitsDates"

// Núcleo puro (sem GI) do contrato de hábitos: port fiel de Vida/Scripts/habitos/dados.js
// Contrato canônico: Vida/docs/habitos.md

export type Tipo = "bool" | "num" | "abstinencia"
export type Estado = "feito" | "parcial" | "falhou" | "pulado"
export type EstadoDia = Estado | "pendente" | "sem_registro" | "fora"
export type Src = "obsidian" | "ags" | "auto"

export interface Habito {
  key: string
  nome: string
  tipo: Tipo
  cor: string | null
  quando: string | null
  minimo: string | null
  meta: number | null
  unidade: string | null
  auto: boolean
  inicio: string
}

export interface Config {
  versao: 1
  inicio: string
  lembretes: { manha: string; noite: string }
  habitos: Habito[]
}

export interface Evento {
  ts: number
  d: string
  h: string
  op: "set" | "add"
  s?: Estado | null
  v?: number | null
  n?: string | null
  src: Src
}

export interface Entrada {
  s: Estado | null
  v: number | null
  n: string | null
  ts: number
  src: Src
  auto: boolean
}

export type Mapa = Map<string, Entrada>

export interface DiaInfo {
  estado: EstadoDia
  contrib: number | null
  v: number | null
  n: string | null
  auto: boolean
}

export interface Janela {
  n: number
  total: number
  pct: number | null
}

export interface Resumo {
  score: number
  scoreSemanaPassada: number
  taxa7: number | null
  taxa30: number | null
  taxa90: number | null
  semana: { feitos: number; total: number }
  melhorSeq: number
  seqAtual: number
  total: number
  limpos: { d30: Janela; d90: Janela; ano: Janela } | null
  naoFalheDuasVezes: boolean
}

export const TIPOS: readonly Tipo[] = ["bool", "num", "abstinencia"]
export const ESTADOS: readonly Estado[] = ["feito", "parcial", "falhou", "pulado"]
export const SRCS: readonly Src[] = ["obsidian", "ags", "auto"]
export const M = Math.pow(0.5, 1 / 13)

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

// Config
function fail(msg: string): never {
  throw new Error(`habitos_config: ${msg}`)
}
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)
const numOuNulo = (x: unknown): boolean => x == null || (typeof x === "number" && Number.isFinite(x) && x > 0)
const strOuNulo = (x: unknown): boolean => x == null || typeof x === "string"
const strN = (x: unknown): string | null => (typeof x === "string" ? x : null)

function validarHabito(h: unknown, i: number, inicioGlobal: string, vistos: Set<string>): Habito {
  const r = `habitos[${i}]`
  if (!isObj(h)) fail(`${r} não é objeto`)
  if (typeof h.key !== "string" || !h.key) fail(`${r}.key ausente`)
  if (vistos.has(h.key)) fail(`key duplicada: ${h.key}`)
  vistos.add(h.key)
  if (typeof h.nome !== "string" || !h.nome) fail(`${h.key}.nome ausente`)
  if (!TIPOS.includes(h.tipo as Tipo)) fail(`${h.key}.tipo inválido: ${String(h.tipo)}`)
  if (!numOuNulo(h.meta)) fail(`${h.key}.meta deve ser número > 0 ou null`)
  if (h.inicio != null && !dataValida(h.inicio)) fail(`${h.key}.inicio inválido: ${String(h.inicio)}`)
  if (![h.cor, h.quando, h.minimo, h.unidade].every(strOuNulo)) fail(`${h.key}: cor/quando/minimo/unidade devem ser texto`)
  return {
    key: h.key,
    nome: h.nome,
    tipo: h.tipo as Tipo,
    cor: strN(h.cor),
    quando: strN(h.quando),
    minimo: strN(h.minimo),
    meta: typeof h.meta === "number" ? h.meta : null,
    unidade: strN(h.unidade),
    auto: h.auto === true,
    inicio: typeof h.inicio === "string" && h.inicio ? h.inicio : inicioGlobal,
  }
}

export function parseConfig(text: string): Config {
  let c: unknown
  try {
    c = JSON.parse(text)
  } catch (e) {
    return fail(`JSON inválido (${e instanceof Error ? e.message : String(e)})`)
  }
  if (!isObj(c)) fail("raiz deve ser objeto")
  if (c.versao !== 1) fail(`versao não suportada: ${String(c.versao)}`)
  if (!dataValida(c.inicio)) fail(`inicio inválido: ${String(c.inicio)}`)
  const lem = isObj(c.lembretes) ? c.lembretes : {}
  for (const k of ["manha", "noite"]) {
    const x = lem[k]
    if (typeof x !== "string" || !RE_HORA.test(x)) fail(`lembretes.${k} deve ser HH:MM`)
  }
  if (!Array.isArray(c.habitos) || !c.habitos.length) fail("habitos deve ser lista não vazia")
  const vistos = new Set<string>()
  const habitos = c.habitos.map((h, i) => validarHabito(h, i, c.inicio as string, vistos))
  return { versao: 1, inicio: c.inicio, lembretes: { manha: lem.manha as string, noite: lem.noite as string }, habitos }
}

// Log
const vNaoNeg = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0

export function eventoValido(e: unknown): e is Evento {
  if (!isObj(e)) return false
  if (typeof e.ts !== "number" || !Number.isFinite(e.ts) || !dataValida(e.d)) return false
  if (typeof e.h !== "string" || !SRCS.includes(e.src as Src)) return false
  if (e.op === "add") return vNaoNeg(e.v)
  if (e.op !== "set") return false
  const sOk = e.s === null || ESTADOS.includes(e.s as Estado)
  const vOk = e.v === null || vNaoNeg(e.v)
  return sOk && vOk && strOuNulo(e.n)
}

export function parseLog(text: string): { eventos: Evento[]; invalidas: number } {
  const eventos: Evento[] = []
  let invalidas = 0
  for (const linha of String(text || "").split("\n")) {
    if (!linha.trim()) continue
    let e: unknown = null
    try {
      e = JSON.parse(linha)
    } catch {
      e = null
    }
    if (eventoValido(e)) eventos.push(e)
    else invalidas += 1
  }
  return { eventos, invalidas }
}

// Fold: set substitui, add soma v; limpar (s,v,n nulos) remove a entrada
export function fold(eventos: Evento[]): Mapa {
  const mapa: Mapa = new Map()
  for (const e of eventos) {
    const k = `${e.d}|${e.h}`
    const ant = mapa.get(k)
    if (e.op === "set") {
      const s = e.s ?? null
      const v = e.v ?? null
      const n = e.n ?? null
      if (s === null && v === null && n === null) mapa.delete(k)
      else mapa.set(k, { s, v, n, ts: e.ts, src: e.src, auto: false })
    } else {
      const auto = (ant ? ant.auto : true) && e.src === "auto"
      mapa.set(k, { s: ant ? ant.s : null, v: ((ant && ant.v) || 0) + (e.v ?? 0), n: ant ? ant.n : null, ts: e.ts, src: e.src, auto })
    }
  }
  return mapa
}

// Estado do dia
function estadoDe(hab: Habito, e: Entrada | null, d: string, hoje: string): EstadoDia {
  const abst = hab.tipo === "abstinencia"
  const s = e && e.s
  if (s && (!abst || s === "feito" || s === "falhou")) return s
  if (!abst && e && e.v !== null && e.v > 0 && hab.meta) return e.v >= hab.meta ? "feito" : "parcial"
  return d >= hoje ? "pendente" : "sem_registro"
}

function contribDe(hab: Habito, estado: EstadoDia, v: number | null): number | null {
  if (estado === "feito") return 1
  if (estado === "falhou" || estado === "sem_registro") return 0
  if (estado !== "parcial") return null
  return hab.tipo === "num" && hab.meta && v !== null && v > 0 ? Math.min(1, v / hab.meta) : 0.5
}

export function estadoDia(hab: Habito, mapa: Mapa, d: string, hoje: string): DiaInfo {
  if (d < hab.inicio) return { estado: "fora", contrib: null, v: null, n: null, auto: false }
  const e = mapa.get(`${d}|${hab.key}`) ?? null
  const estado = estadoDe(hab, e, d, hoje)
  return { estado, contrib: contribDe(hab, estado, e ? e.v : null), v: e ? e.v : null, n: e ? e.n : null, auto: !!(e && e.auto) }
}

// Score de força e taxas
interface Linha extends DiaInfo {
  d: string
  score: number
}

function serieCompleta(hab: Habito, mapa: Mapa, hoje: string): Linha[] {
  const out: Linha[] = []
  let score = 0
  const n = diasEntre(hab.inicio, hoje)
  for (let i = 0; i <= n; i += 1) {
    const d = addDias(hab.inicio, i)
    const r = estadoDia(hab, mapa, d, hoje)
    if (r.contrib !== null) score = score * M + r.contrib * (1 - M)
    out.push({ d, score, ...r })
  }
  return out
}

export function serieScore(hab: Habito, mapa: Mapa, hoje: string, dias = 90): { d: string; score: number }[] {
  return serieCompleta(hab, mapa, hoje).slice(-dias).map(({ d, score }) => ({ d, score }))
}

function taxa(serie: Linha[], hoje: string, n: number): number | null {
  const ini = addDias(hoje, -(n - 1))
  const xs = serie.filter((r) => r.d >= ini && r.contrib !== null)
  return xs.length ? xs.reduce((a, r) => a + (r.contrib ?? 0), 0) / xs.length : null
}

function sequencias(serie: Linha[]): { melhorSeq: number; seqAtual: number } {
  let run = 0
  let best = 0
  for (const r of serie) {
    if (r.estado === "feito") {
      run += 1
      best = Math.max(best, run)
    } else if (r.estado !== "pulado" && r.estado !== "pendente") run = 0
  }
  return { melhorSeq: best, seqAtual: run }
}

function limpos(serie: Linha[], hoje: string): NonNullable<Resumo["limpos"]> {
  const janela = (ini: string): Janela => {
    const xs = serie.filter((r) => r.d >= ini && r.contrib !== null)
    const n = xs.filter((r) => r.estado === "feito").length
    return { n, total: xs.length, pct: xs.length ? n / xs.length : null }
  }
  return { d30: janela(addDias(hoje, -29)), d90: janela(addDias(hoje, -89)), ano: janela(`${hoje.slice(0, 4)}-01-01`) }
}

function resumoSemana(hab: Habito, mapa: Mapa, hoje: string): { feitos: number; total: number } {
  const seg = segundaDe(hoje)
  let feitos = 0
  let total = 0
  for (let i = 0; i < 7; i += 1) {
    const r = estadoDia(hab, mapa, addDias(seg, i), hoje)
    if (r.estado === "fora" || r.estado === "pulado") continue
    total += 1
    if (r.estado === "feito") feitos += 1
  }
  return { feitos, total }
}

export function resumo(hab: Habito, mapa: Mapa, hoje: string): Resumo {
  const s = serieCompleta(hab, mapa, hoje)
  const passada = s.find((r) => r.d === addDias(hoje, -7))
  const ontem = s.find((r) => r.d === addDias(hoje, -1))
  const hojeRow = s.find((r) => r.d === hoje)
  return {
    score: s.length ? s[s.length - 1].score : 0,
    scoreSemanaPassada: passada ? passada.score : 0,
    taxa7: taxa(s, hoje, 7),
    taxa30: taxa(s, hoje, 30),
    taxa90: taxa(s, hoje, 90),
    semana: resumoSemana(hab, mapa, hoje),
    ...sequencias(s),
    total: s.reduce((a, r) => a + (r.v || 0), 0),
    limpos: hab.tipo === "abstinencia" ? limpos(s, hoje) : null,
    naoFalheDuasVezes: !!(
      ontem && hojeRow && hojeRow.estado === "pendente" && (ontem.estado === "falhou" || ontem.estado === "sem_registro")
    ),
  }
}

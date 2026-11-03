// Validação pura de escrita (espelha Vida/Scripts/habitos/registro.js)
import { Config, ESTADOS, Estado, Evento, Habito, SRCS, Src, dataValida } from "./habitsCore"

export interface SetInput {
  d: string
  h: string
  s?: Estado | null
  v?: number | null
  n?: string | null
  src?: Src
}

export interface AddInput {
  d: string
  h: string
  v: number
  src?: Src
}

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0
const err = (msg: string): never => {
  throw new Error(`habitos: ${msg}`)
}

function acharHabito(cfg: Config, key: string): Habito {
  return cfg.habitos.find((h) => h.key === key) ?? err(`hábito desconhecido: ${key}`)
}

function validarBase(hab: Habito, d: string, src: Src): void {
  if (!dataValida(d)) err(`data inválida: ${d}`)
  if (!SRCS.includes(src)) err(`src inválido: ${src}`)
  if (d < hab.inicio) err(`${hab.key} começa em ${hab.inicio}; ${d} é anterior`)
}

function validarSet(hab: Habito, s: Estado | null, v: number | null, n: string | null): void {
  const permitidos: readonly Estado[] = hab.tipo === "abstinencia" ? ["feito", "falhou"] : ESTADOS
  if (s !== null && !permitidos.includes(s)) err(`estado "${s}" inválido para ${hab.tipo}`)
  if (v !== null && !num(v)) err(`v deve ser número finito >= 0 ou null: ${v}`)
  if (v !== null && hab.tipo === "abstinencia") err("abstinencia não aceita v")
  if (n !== null && typeof n !== "string") err("n deve ser texto ou null")
}

export function montarSet(cfg: Config, i: SetInput, now = Date.now()): Evento {
  const hab = acharHabito(cfg, i.h)
  const { s = null, v = null, n = null, src = "ags" } = i
  validarBase(hab, i.d, src)
  validarSet(hab, s, v, n)
  return { ts: now, d: i.d, h: i.h, op: "set", s, v, n, src }
}

export function montarAdd(cfg: Config, i: AddInput, now = Date.now()): Evento {
  const hab = acharHabito(cfg, i.h)
  const src = i.src ?? "ags"
  validarBase(hab, i.d, src)
  if (hab.tipo !== "num") err(`somar só vale para tipo num (${i.h} é ${hab.tipo})`)
  if (!num(i.v)) err(`v deve ser número finito >= 0: ${i.v}`)
  return { ts: now, d: i.d, h: i.h, op: "add", v: i.v, src }
}

// Tipos e parsing puros (sem GI) do estado de estudo ativo

export type ActiveStudy = {
  active: true
  materia: string
  file: string
  vault: string
  relPath: string
  inicioMs: number
  gastoMin: number
  estimadoMin: number
  bloco?: string
  blocoLabel?: string
  cor?: string
}

export type StudyState = { active: false } | ActiveStudy

export type ContractState = { state: StudyState; updatedAt: number }

const HEX = /^#[0-9a-fA-F]{6}$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === "string" ? v : "")
const nonNeg = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0)

// Valida o JSON do contrato v1; retorna null se inválido/parcial/versão desconhecida
export function parseContract(text: string, vaultRoot: string): ContractState | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObj(raw) || raw.v !== 1 || typeof raw.active !== "boolean") return null
  const updatedAt = nonNeg(raw.updatedAt)
  if (!raw.active) return { state: { active: false }, updatedAt }
  const materia = str(raw.materia)
  const relPath = str(raw.relPath)
  const inicioMs = nonNeg(raw.inicioMs)
  if (!materia || !relPath || !inicioMs) return null
  const vault = str(raw.vault)
  return {
    updatedAt,
    state: {
      active: true,
      materia,
      file: `${vaultRoot}/${relPath}.md`,
      vault,
      relPath,
      inicioMs,
      gastoMin: nonNeg(raw.gastoMin),
      estimadoMin: nonNeg(raw.estimadoMin),
      bloco: str(raw.bloco) || undefined,
      blocoLabel: str(raw.blocoLabel) || undefined,
      cor: HEX.test(str(raw.cor)) ? str(raw.cor) : undefined,
    },
  }
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

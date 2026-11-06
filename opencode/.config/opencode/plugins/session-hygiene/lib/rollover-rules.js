export const DEFAULT_THRESHOLDS = { maxRequests: 40, maxCompactions: 2, maxAgeMs: 3 * 24 * 3600 * 1000, contextFreshMs: 2 * 3600 * 1000 }

/**
 * stats: { requests, compactions, ageMs, contextAgeMs|null }
 * Retorna as razões que justificam o aviso (lista vazia = sem aviso).
 */
export function rolloverReasons(stats, t = DEFAULT_THRESHOLDS) {
  const reasons = []
  if (stats.requests >= t.maxRequests) reasons.push(`${stats.requests} pedidos do usuário`)
  if (stats.compactions >= t.maxCompactions) reasons.push(`${stats.compactions} compactações`)
  if (stats.ageMs >= t.maxAgeMs) reasons.push(`${Math.floor(stats.ageMs / 86_400_000)} dias de idade`)
  return reasons
}

export function contextIsFresh(stats, t = DEFAULT_THRESHOLDS) {
  return stats.contextAgeMs !== null && stats.contextAgeMs < t.contextFreshMs
}

export function buildWarning(reasons) {
  return [
    `[session-hygiene] Esta sessão raiz está longa (${reasons.join(", ")}).`,
    "Nesta resposta: (1) grave o estado atual em `.aiflow/context.md` (decisões vigentes, arquivos tocados, commit atual, pendências, próximos passos);",
    "(2) informe ao usuário, em uma linha, que recomenda abrir uma nova sessão consumindo esse arquivo.",
  ].join(" ")
}

/** Retorna o texto de aviso ou null. */
export function warningFor(stats, t = DEFAULT_THRESHOLDS) {
  const reasons = rolloverReasons(stats, t)
  if (!reasons.length || contextIsFresh(stats, t)) return null
  return buildWarning(reasons)
}

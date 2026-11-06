export const DEFAULT_LIMITS = { maxSteps: 60, maxContext: 80_000, handoffChars: 1500 }

/** Contexto efetivo de um passo: input + cache.read + cache.write. */
export function stepContext(tokens) {
  return (tokens?.input ?? 0) + (tokens?.cache?.read ?? 0) + (tokens?.cache?.write ?? 0)
}

export function truncate(text, max) {
  const clean = (text ?? "").trim()
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}…`
}

/**
 * Decide se a sessão filha deve ser descartada.
 * stats: { running, assistantCount, lastContext, lastText } | null
 */
export function shouldRetire(stats, limits = DEFAULT_LIMITS) {
  if (!stats || stats.running) return false
  return stats.assistantCount > limits.maxSteps || stats.lastContext > limits.maxContext
}

export function buildHandoff(sessionID, lastText, limits = DEFAULT_LIMITS) {
  const report = truncate(lastText, limits.handoffChars) || "(sem relatório final disponível)"
  return `Sessão anterior ${sessionID} encerrada por tamanho. Último relatório dela:\n${report}\n\n---\n`
}

/** Retorna o novo input da tool `subagent`, ou null se nada muda. */
export function rewriteSubagentInput(input, stats, limits = DEFAULT_LIMITS) {
  const sessionID = input?.sessionID
  if (typeof sessionID !== "string" || !sessionID) return null
  if (!shouldRetire(stats, limits)) return null
  const { sessionID: _dropped, ...rest } = input
  const prompt = `${buildHandoff(sessionID, stats.lastText, limits)}${rest.prompt ?? ""}`
  return { ...rest, prompt }
}

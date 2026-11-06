import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { rolloverReasons } from "./rollover-rules.js"

export const HANDOFF_MAX_CHARS = 3000
const AGENT = "orchestrator"

/** Texto da primeira mensagem da sessão nova (≤ max chars). */
export function buildHandoff({ oldID, contextMd, lastText, max = HANDOFF_MAX_CHARS }) {
  const header = `# Continuação de ${oldID}\n\n`
  const source = contextMd?.trim()
    ? `Estado gravado em .aiflow/context.md:\n\n${contextMd.trim()}`
    : `Última resposta da sessão anterior:\n\n${(lastText ?? "").trim() || "(sem texto disponível)"}`
  const full = header + source
  return full.length <= max ? full : `${full.slice(0, max - 1)}…`
}

async function readContext(directory) {
  try {
    return await readFile(join(directory, ".aiflow", "context.md"), "utf8")
  } catch (err) {
    if (err.code === "ENOENT") return null
    throw err
  }
}

/**
 * Executa o rollover de uma sessão raiz que acabou de ficar ociosa.
 * deps: { rootStats, lastText(id), claim(id)->bool (idempotência), client, navigate, isViewing(id), log }
 * Retorna o ID da sessão nova ou null.
 */
export async function maybeRollover(sessionID, deps) {
  const stats = await deps.rootStats(sessionID)
  if (!stats || !rolloverReasons(stats).length) return null
  if (!(await deps.claim(sessionID))) return null
  const [contextMd, lastText] = await Promise.all([readContext(stats.directory), deps.lastText(sessionID)])
  const created = await deps.client.session.create({
    title: `Continuação de ${sessionID}`,
    agent: AGENT,
    location: { directory: stats.directory },
  })
  await deps.client.session.prompt({ sessionID: created.id, text: buildHandoff({ oldID: sessionID, contextMd, lastText }) })
  if (deps.isViewing(sessionID)) deps.navigate({ type: "session", sessionID: created.id })
  deps.log(`rollover ${sessionID} → ${created.id}`)
  return created.id
}

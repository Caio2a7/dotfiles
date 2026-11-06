/**
 * session-hygiene — higiene automática de sessões (OpenCode V2).
 *
 *  a) subagent: sessão filha grande é descartada e substituída por handoff.
 *  b) shell: agentes não-orchestrator não editam/leem código via shell.
 *  c) orchestrator raiz longo: injeta aviso para gravar .aiflow/context.md.
 *
 * Falha interna nunca derruba a chamada: loga e deixa passar.
 * Opções: { maxSteps, maxContext, handoffChars }.
 */
import { childStats, rootStats } from "./lib/db.js"
import { blockedCommand, checkShellCommand } from "./lib/shell-rules.js"
import { DEFAULT_LIMITS, rewriteSubagentInput } from "./lib/subagent-rules.js"
import { warningFor } from "./lib/rollover-rules.js"

const SHELL_TOOLS = new Set(["shell", "bash"])
const EXEMPT_AGENT = "orchestrator"

function log(scope, err) {
  const reason = err instanceof Error ? err.message : String(err)
  console.error(`[session-hygiene] ${scope}: ${reason}`)
}

async function guardSubagent(event, limits) {
  const sessionID = event.input?.sessionID
  if (typeof sessionID !== "string" || !sessionID) return
  const stats = await childStats(sessionID)
  const next = rewriteSubagentInput(event.input, stats, limits)
  if (next) {
    event.input = next
    console.error(`[session-hygiene] sessão ${sessionID} descartada (${stats.assistantCount} passos, ${stats.lastContext} tokens de contexto)`)
  }
}

function guardShell(event) {
  if (event.agent === EXEMPT_AGENT) return
  const finding = checkShellCommand(event.input?.command)
  if (!finding) return
  event.input = { ...event.input, command: blockedCommand(finding) }
  console.error(`[session-hygiene] shell bloqueado para ${event.agent}: ${finding.reason}`)
}

async function onToolBefore(event, limits) {
  if (event.tool === "subagent") await guardSubagent(event, limits)
  else if (SHELL_TOOLS.has(event.tool)) guardShell(event)
}

export default {
  id: "local.session-hygiene",
  async setup(ctx) {
    const limits = { ...DEFAULT_LIMITS, ...(ctx.options ?? {}) }
    /** sessionID -> texto do aviso vigente (recalculado a cada prompt do usuário) */
    const warnings = new Map()

    await ctx.tool.hook("execute.before", async (event) => {
      try {
        await onToolBefore(event, limits)
      } catch (err) {
        log(`tool ${event.tool}`, err)
      }
    })

    await ctx.session.hook("prompt", async (event) => {
      try {
        const stats = await rootStats(event.sessionID)
        const text = stats && warningFor(stats)
        if (text) warnings.set(event.sessionID, text)
        else warnings.delete(event.sessionID)
      } catch (err) {
        log(`prompt ${event.sessionID}`, err)
      }
    })

    await ctx.session.hook("context", (event) => {
      try {
        const text = warnings.get(event.sessionID)
        if (text && event.agent === EXEMPT_AGENT) event.system.push({ type: "text", text })
      } catch (err) {
        log(`context ${event.sessionID}`, err)
      }
    })
  },
}

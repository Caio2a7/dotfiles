/**
 * session-hygiene — regras de shell (OpenCode V2).
 *
 * Agentes não-orchestrator não escrevem arquivos via shell (sed -i, perl -i,
 * redirecionamento/heredoc/tee, python lendo script do stdin): devem usar
 * `edit`/`write`. Leitura via shell (cat, sed -n, head, jq, grep...) é livre.
 *
 * Falha interna nunca derruba a chamada: loga e deixa passar.
 */
import { blockedCommand, checkShellCommand } from "./lib/shell-rules.js"

const SHELL_TOOLS = new Set(["shell", "bash"])
const EXEMPT_AGENT = "orchestrator"

function log(scope, err) {
  const reason = err instanceof Error ? err.message : String(err)
  console.error(`[session-hygiene] ${scope}: ${reason}`)
}

function guardShell(event) {
  if (event.agent === EXEMPT_AGENT) return
  const finding = checkShellCommand(event.input?.command)
  if (!finding) return
  event.input = { ...event.input, command: blockedCommand(finding) }
  console.error(`[session-hygiene] shell bloqueado para ${event.agent}: ${finding.reason}`)
}

export default {
  id: "local.session-hygiene",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", async (event) => {
      try {
        if (SHELL_TOOLS.has(event.tool)) guardShell(event)
      } catch (err) {
        log(`tool ${event.tool}`, err)
      }
    })
  },
}

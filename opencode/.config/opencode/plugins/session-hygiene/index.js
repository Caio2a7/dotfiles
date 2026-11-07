/**
 * session-hygiene — regras de shell (OpenCode V2).
 *
 * Nenhum agente escreve arquivos via shell (sed -i, perl -i,
 * redirecionamento/heredoc/tee, python lendo script do stdin): devem usar
 * `edit`/`write` (orchestrator delega). Exceções: /dev/null, /tmp/ e *.log. Leitura via shell (cat, sed -n, head, jq, grep...) é livre.
 *
 * Falha interna nunca derruba a chamada: loga e deixa passar.
 */
import { blockedCommand, shellVerdict } from "./lib/shell-rules.js"

const SHELL_TOOLS = new Set(["shell", "bash"])

function log(scope, err) {
  const reason = err instanceof Error ? err.message : String(err)
  console.error(`[session-hygiene] ${scope}: ${reason}`)
}

function guardShell(event) {
  const finding = shellVerdict(event.input?.command, event.agent)
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

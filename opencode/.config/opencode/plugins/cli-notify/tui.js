import { spawn } from "node:child_process"
import { basename } from "node:path"

// Envia a notificação desktop; erros do processo são logados, nunca derrubam a TUI
function send(title, body) {
  const proc = spawn("notify-send", ["-a", "OpenCode", "-i", "utilities-terminal", title, body], { stdio: "ignore" })
  proc.on("error", (err) => console.error("[cli-notify] notify-send falhou:", err))
}

const plugin = {
  id: "cli-notify",
  setup(context) {
    let focused = true
    const running = new Set()
    const onFocus = () => { focused = true }
    const onBlur = () => { focused = false }
    context.renderer.on("focus", onFocus)
    context.renderer.on("blur", onBlur)

    const tuiDirectory = () => (context.location ?? context.data.location.default())?.directory

    // Filtros a) foco, b) diretório desta TUI, c) sessão filha
    const shouldNotify = (event, sessionID) => {
      if (focused) return false
      const dir = tuiDirectory()
      if (!dir || !event.location?.directory || event.location.directory !== dir) return false
      return !context.data.session.get(sessionID)?.parentID
    }

    const notify = (event, sessionID, message) => {
      const title = context.data.session.get(sessionID)?.title || "OpenCode"
      send(title, `${message} — ${basename(event.location.directory)}`)
    }

    // Eventos de término só notificam se esta TUI viu o início da execução
    const onFinish = (message) => (event) => {
      const sessionID = event.data.sessionID
      const seen = running.delete(sessionID)
      if (seen && shouldNotify(event, sessionID)) notify(event, sessionID, message)
    }
    const onAsk = (message, getSession) => (event) => {
      const sessionID = getSession(event)
      if (sessionID && shouldNotify(event, sessionID)) notify(event, sessionID, message)
    }

    const handlers = {
      "session.execution.started": (event) => { running.add(event.data.sessionID) },
      "session.execution.succeeded": onFinish("Resposta pronta"),
      "session.execution.failed": onFinish("Erro na sessão"),
      "permission.asked": onAsk("Permissão necessária", (e) => e.data.sessionID),
      "form.created": onAsk("Pergunta aguardando resposta", (e) => e.data.form?.sessionID),
    }

    const unsubs = Object.entries(handlers).map(([type, handler]) =>
      context.data.on(type, (event) => {
        try {
          handler(event)
        } catch (err) {
          console.error(`[cli-notify] erro em ${type}:`, err)
        }
      }),
    )

    return () => {
      unsubs.forEach((off) => off())
      context.renderer.off("focus", onFocus)
      context.renderer.off("blur", onBlur)
    }
  },
}

export default plugin

/**
 * session-hygiene-tui — rollover automático da sessão raiz do orchestrator.
 * Ao concluir uma resposta, se a sessão passou dos limiares (rollover-rules.js),
 * cria uma sessão nova com handoff e navega a TUI até ela.
 * Idempotência: cada sessão antiga só rola uma vez (store durável compartilhado entre TUIs).
 */
import { childStats, rootStats } from "../session-hygiene/lib/db.js"
import { maybeRollover } from "../session-hygiene/lib/rollover-flow.js"

const tag = "[session-hygiene-tui]"

const plugin = {
  id: "session-hygiene-tui",
  setup(context) {
    const [state, mutate] = context.storage.store("rollover", { initial: { done: {} } })
    const inFlight = new Set()

    const claim = async (id) => {
      if (state.done[id] || inFlight.has(id)) return false
      inFlight.add(id)
      await mutate((draft) => { draft.done[id] = Date.now() })
      return true
    }

    const deps = {
      rootStats,
      lastText: async (id) => (await childStats(id))?.lastText ?? "",
      claim,
      client: context.client,
      navigate: (dest) => context.ui.router.navigate(dest),
      isViewing: (id) => {
        const route = context.ui.router.current()
        return route.type === "session" && route.sessionID === id
      },
      log: (msg) => console.error(`${tag} ${msg}`),
    }

    const onSucceeded = async (event) => {
      const id = event.data.sessionID
      const dir = (context.location ?? context.data.location.default())?.directory
      if (context.data.session.get(id)?.parentID) return
      if (dir && event.location?.directory && event.location.directory !== dir) return
      try {
        await maybeRollover(id, deps)
      } catch (err) {
        console.error(`${tag} falha no rollover de ${id}:`, err)
      }
    }

    return context.data.on("session.execution.succeeded", (event) => { void onSucceeded(event) })
  },
}

export default plugin

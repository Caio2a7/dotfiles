import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildHandoff, maybeRollover, HANDOFF_MAX_CHARS } from "../lib/rollover-flow.js"

const LONG = { requests: 50, compactions: 0, ageMs: 0, contextAgeMs: null }

function makeDeps(over = {}) {
  const calls = { create: [], prompt: [], nav: [] }
  const claimed = new Set()
  const deps = {
    rootStats: async () => ({ ...LONG, directory: "/nonexistent-dir" }),
    lastText: async () => "última resposta",
    claim: async (id) => (claimed.has(id) ? false : (claimed.add(id), true)),
    client: {
      session: {
        create: async (i) => { calls.create.push(i); return { id: "ses_new" } },
        prompt: async (i) => { calls.prompt.push(i); return {} },
      },
    },
    navigate: (d) => calls.nav.push(d),
    isViewing: () => true,
    log: () => {},
    ...over,
  }
  return { deps, calls }
}

test("buildHandoff: título e truncamento", () => {
  const t = buildHandoff({ oldID: "ses_a", contextMd: "x".repeat(5000), lastText: "" })
  assert.ok(t.startsWith("# Continuação de ses_a"))
  assert.equal(t.length, HANDOFF_MAX_CHARS)
})

test("buildHandoff: sem context.md usa última resposta", () => {
  assert.match(buildHandoff({ oldID: "ses_a", contextMd: null, lastText: "resp" }), /resp/)
  assert.match(buildHandoff({ oldID: "ses_a", contextMd: "  ", lastText: "" }), /sem texto disponível/)
})

test("rola sessão longa: cria, envia handoff e navega", async () => {
  const { deps, calls } = makeDeps()
  assert.equal(await maybeRollover("ses_old", deps), "ses_new")
  assert.equal(calls.create[0].agent, "orchestrator")
  assert.equal(calls.create[0].location.directory, "/nonexistent-dir")
  assert.match(calls.prompt[0].text, /Continuação de ses_old/)
  assert.deepEqual(calls.nav, [{ type: "session", sessionID: "ses_new" }])
})

test("idempotente: segunda chamada não rola", async () => {
  const { deps, calls } = makeDeps()
  await maybeRollover("ses_old", deps)
  assert.equal(await maybeRollover("ses_old", deps), null)
  assert.equal(calls.create.length, 1)
})

test("sessão curta ou não-orchestrator não rola", async () => {
  const short = makeDeps({ rootStats: async () => ({ ...LONG, requests: 3, directory: "/x" }) })
  assert.equal(await maybeRollover("ses_a", short.deps), null)
  const none = makeDeps({ rootStats: async () => null })
  assert.equal(await maybeRollover("ses_a", none.deps), null)
  assert.equal(short.calls.create.length + none.calls.create.length, 0)
})

test("não navega se a TUI não está vendo a sessão antiga", async () => {
  const { deps, calls } = makeDeps({ isViewing: () => false })
  await maybeRollover("ses_old", deps)
  assert.equal(calls.nav.length, 0)
})

test("usa .aiflow/context.md quando existe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "roll-"))
  await mkdir(join(dir, ".aiflow"))
  await writeFile(join(dir, ".aiflow", "context.md"), "ESTADO-XYZ")
  const { deps, calls } = makeDeps({ rootStats: async () => ({ ...LONG, directory: dir }) })
  await maybeRollover("ses_old", deps)
  assert.match(calls.prompt[0].text, /ESTADO-XYZ/)
})

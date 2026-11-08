import { test } from "node:test"
import assert from "node:assert/strict"
import { syncMark, syncSessionModel } from "../lib/sync.js"

const OLD = { providerID: "claude-code", id: "claude-opus-5-5[" + "1m]" }
const NEW = { providerID: "claude-code", id: "claude-opus-5-5" }
const MANUAL = { providerID: "claude-code", id: "claude-haiku-4-5" }

function fakeCtx({ agentModel, sessionModel, mark, sessionAgent = "orchestrator", switchError }) {
  const store = new Map(mark === undefined ? [] : [["synced-agent:s1", mark]])
  const switched = []
  return {
    store,
    switched,
    session: {
      get: async () => ({ agent: sessionAgent, model: sessionModel }),
      switchModel: async (input) => {
        if (switchError) throw switchError
        switched.push(input.model)
      },
    },
    agent: {
      list: async () => ({ data: [{ id: "agentic" }, { id: "orchestrator" }] }),
      get: async () => ({ data: { id: "orchestrator", model: agentModel } }),
    },
    storage: { get: async (k) => store.get(k), set: async (k, v) => { store.set(k, v) } },
  }
}

test("marca antiga (só agentID) gera resync único", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, mark: "orchestrator" })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [NEW])
  assert.equal(ctx.store.get("synced-agent:s1"), syncMark("orchestrator", NEW))
  await syncSessionModel(ctx, "s1")
  assert.equal(ctx.switched.length, 1)
})

test("modelo do agente mudou: troca o modelo da sessão", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, mark: syncMark("orchestrator", OLD) })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [NEW])
})

test("variant mudou: troca o modelo da sessão", async () => {
  const low = { ...NEW, variant: "low" }
  const ctx = fakeCtx({ agentModel: low, sessionModel: NEW, mark: syncMark("orchestrator", NEW) })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [low])
})

test("troca manual preservada se o agente não mudou", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: MANUAL, mark: syncMark("orchestrator", NEW) })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [])
})

test("sessão nova sem marca recebe o modelo do agente", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: MANUAL })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [NEW])
})

test("sessão já no modelo do agente só grava a marca", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: { ...NEW } })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [])
  assert.equal(ctx.store.get("synced-agent:s1"), syncMark("orchestrator", NEW))
})

test("agente sem model não faz nada", async () => {
  const ctx = fakeCtx({ agentModel: undefined, sessionModel: OLD, mark: "orchestrator" })
  await syncSessionModel(ctx, "s1")
  assert.deepEqual(ctx.switched, [])
  assert.equal(ctx.store.get("synced-agent:s1"), "orchestrator")
})

test("sessão sem agente não sincroniza nem chuta o 1º da lista", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, sessionAgent: null })
  assert.equal(await syncSessionModel(ctx, "s1"), "no-agent")
  assert.deepEqual(ctx.switched, [])
  assert.equal(ctx.store.has("synced-agent:s1"), false)
})

test("switchModel que lança não grava a marca", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, mark: "orchestrator", switchError: new Error("boom") })
  await assert.rejects(syncSessionModel(ctx, "s1"), /boom/)
  assert.equal(ctx.store.get("synced-agent:s1"), "orchestrator")
})

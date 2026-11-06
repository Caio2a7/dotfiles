import { test } from "node:test"
import assert from "node:assert/strict"
import { buildHandoff, rewriteSubagentInput, shouldRetire, stepContext, truncate } from "../lib/subagent-rules.js"
import { rolloverReasons, warningFor } from "../lib/rollover-rules.js"

const DAY = 86_400_000
const small = { running: false, assistantCount: 10, lastContext: 20_000, lastText: "feito" }

test("stepContext soma input + cache.read + cache.write", () => {
  assert.equal(stepContext({ input: 1, cache: { read: 10, write: 100 } }), 111)
  assert.equal(stepContext(undefined), 0)
})

test("truncate corta com reticências", () => {
  assert.equal(truncate("abcdef", 3), "abc…")
  assert.equal(truncate("ab", 3), "ab")
})

test("filho pequeno mantém sessionID", () => {
  assert.equal(rewriteSubagentInput({ sessionID: "ses_a", prompt: "p" }, small), null)
})

test("filho com > 60 passos é descartado", () => {
  const out = rewriteSubagentInput({ sessionID: "ses_a", prompt: "novo", agent: "worker" }, { ...small, assistantCount: 61 })
  assert.equal(out.sessionID, undefined)
  assert.equal(out.agent, "worker")
  assert.match(out.prompt, /^Sessão anterior ses_a encerrada por tamanho\. Último relatório dela:\nfeito/)
  assert.ok(out.prompt.endsWith("novo"))
})

test("exatamente 60 passos não descarta", () => {
  assert.equal(shouldRetire({ ...small, assistantCount: 60 }), false)
})

test("contexto > 80k descarta; 80k exatos não", () => {
  assert.equal(shouldRetire({ ...small, lastContext: 80_001 }), true)
  assert.equal(shouldRetire({ ...small, lastContext: 80_000 }), false)
})

test("sessão em execução nunca é tocada", () => {
  const big = { ...small, running: true, assistantCount: 500, lastContext: 900_000 }
  assert.equal(rewriteSubagentInput({ sessionID: "ses_a", prompt: "p" }, big), null)
})

test("sem sessionID ou sem stats nada muda", () => {
  assert.equal(rewriteSubagentInput({ prompt: "p" }, small), null)
  assert.equal(rewriteSubagentInput({ sessionID: "ses_a", prompt: "p" }, null), null)
})

test("handoff trunca relatório longo", () => {
  const text = buildHandoff("ses_a", "x".repeat(5000))
  assert.ok(text.length < 1700)
})

test("aviso: abaixo dos limites não avisa", () => {
  assert.equal(warningFor({ requests: 39, compactions: 1, ageMs: 2 * DAY, contextAgeMs: null }), null)
})

test("aviso: cada gatilho isolado dispara", () => {
  assert.deepEqual(rolloverReasons({ requests: 40, compactions: 0, ageMs: 0 }).length, 1)
  assert.deepEqual(rolloverReasons({ requests: 0, compactions: 2, ageMs: 0 }).length, 1)
  assert.deepEqual(rolloverReasons({ requests: 0, compactions: 0, ageMs: 3 * DAY }).length, 1)
})

test("aviso: context.md recente suprime", () => {
  const stats = { requests: 50, compactions: 0, ageMs: 0, contextAgeMs: 60_000 }
  assert.equal(warningFor(stats), null)
  assert.match(warningFor({ ...stats, contextAgeMs: 5 * 3600_000 }), /\.aiflow\/context\.md/)
})

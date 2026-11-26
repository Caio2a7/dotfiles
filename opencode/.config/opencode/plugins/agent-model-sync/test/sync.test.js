import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sameModel,
  syncMark,
  isAntigravityModel,
  isWebApiModel,
  resolveSubagentModel,
  formatModelRef,
  handleSubagentToolCall,
  syncSessionModel,
} from "../lib/sync.js";

const OLD = { providerID: "claude-code", id: "claude-opus-5-5[" + "1m]" };
const NEW = { providerID: "claude-code", id: "claude-opus-5-5" };
const MANUAL = { providerID: "claude-code", id: "claude-haiku-4-5" };
const SONNET = { providerID: "claude-code", id: "claude-sonnet-5-5" };
const AG_GEMINI = { providerID: "google", id: "antigravity-gemini-3.8-flash", variant: "high" };
const AG_GEMINI_HIGH = { providerID: "google", id: "antigravity-gemini-3.8-flash-high" };
const AG_GEMINI_HIGH_VAR = { providerID: "google", id: "antigravity-gemini-3.8-flash-high", variant: "high" };
const AG_GEMINI_HIGH_DEF = { providerID: "google", id: "antigravity-gemini-3.8-flash-high", variant: "default" };
const AG_OPUS = { providerID: "google", id: "antigravity-claude-opus-4-6-thinking", variant: "max" };
const AGY_FLASH = { providerID: "agy", id: "gemini-3.8-flash", variant: "high" };

function fakeCtx({
  agentModel,
  sessionModel,
  mark,
  sessionAgent = "orchestrator",
  parentID = null,
  parentModel = null,
  parentAgent = "orchestrator",
  switchError,
}) {
  const store = new Map(mark === undefined ? [] : [["synced-agent:s1", mark]]);
  const switched = [];
  const sessions = new Map();

  sessions.set("s1", {
    id: "s1",
    agent: sessionAgent,
    model: sessionModel,
    parentID,
  });

  if (parentID) {
    sessions.set(parentID, {
      id: parentID,
      agent: parentAgent,
      model: parentModel,
      parentID: null,
    });
  }

  return {
    store,
    switched,
    session: {
      get: async ({ sessionID }) => sessions.get(sessionID),
      switchModel: async (input) => {
        if (switchError) throw switchError;
        switched.push(input.model);
        const s = sessions.get(input.sessionID);
        if (s) s.model = input.model;
      },
    },
    agent: {
      list: async () => ({ data: [{ id: "agentic" }, { id: "orchestrator" }, { id: "worker" }] }),
      get: async ({ agentID }) => ({ data: { id: agentID, model: agentModel } }),
    },
    storage: {
      get: async (k) => store.get(k),
      set: async (k, v) => { store.set(k, v); },
    },
  };
}

test("isAntigravityModel identifica corretamente modelos Antigravity e agy", () => {
  assert.equal(isAntigravityModel(AG_GEMINI), true);
  assert.equal(isAntigravityModel(AG_GEMINI_HIGH), true);
  assert.equal(isAntigravityModel(AG_OPUS), true);
  assert.equal(isAntigravityModel(AGY_FLASH), true);
  assert.equal(isAntigravityModel({ providerID: "google", id: "gemini-2.5-flash" }), true);
  assert.equal(isAntigravityModel("google/antigravity-gemini-3.8-flash-high"), true);
  assert.equal(isAntigravityModel("agy/gemini-3.8-flash#high"), true);
  assert.equal(isAntigravityModel("antigravity-gemini-3.8-flash"), true);

  assert.equal(isAntigravityModel(SONNET), false);
  assert.equal(isAntigravityModel(NEW), false);
  assert.equal(isAntigravityModel("claude-code/claude-sonnet-5-5"), false);
  assert.equal(isAntigravityModel(null), false);
  assert.equal(isAntigravityModel(undefined), false);
});

test("isWebApiModel identifica corretamente modelos WebApi", () => {
  assert.equal(isWebApiModel({ providerID: "webapi", id: "sonnet-5.5" }), true);
  assert.equal(isWebApiModel({ providerID: "other", id: "sonnet-5.5" }), true);
  assert.equal(isWebApiModel({ providerID: "other", id: "sonnet-5.5-high" }), true);
  assert.equal(isWebApiModel({ providerID: "other", id: "sonnet-5.5-extra" }), true);
  assert.equal(isWebApiModel({ providerID: "other", id: "s4" }), true);
  assert.equal(isWebApiModel({ providerID: "webapi", id: "custom" }), true);
  assert.equal(isWebApiModel("webapi/sonnet-5.5"), true);
  assert.equal(isWebApiModel("sonnet-5.5"), true);
  assert.equal(isWebApiModel("sonnet-5.5-high"), true);
  assert.equal(isWebApiModel("sonnet-5.5-extra"), true);
  assert.equal(isWebApiModel("s4"), true);

  assert.equal(isWebApiModel(NEW), false);
  assert.equal(isWebApiModel(null), false);
  assert.equal(isWebApiModel(undefined), false);
});

test("formatModelRef formata modelos e remove variant redundante ou default", () => {
  assert.equal(formatModelRef(AG_GEMINI), "google/antigravity-gemini-3.8-flash#high");
  assert.equal(formatModelRef(AGY_FLASH), "agy/gemini-3.8-flash#high");
  assert.equal(formatModelRef(AG_GEMINI_HIGH), "google/antigravity-gemini-3.8-flash-high");
  assert.equal(formatModelRef(AG_GEMINI_HIGH_VAR), "google/antigravity-gemini-3.8-flash-high");
  assert.equal(formatModelRef(AG_GEMINI_HIGH_DEF), "google/antigravity-gemini-3.8-flash-high");
  assert.equal(formatModelRef(AG_OPUS), "google/antigravity-claude-opus-4-6-thinking#max");
  assert.equal(formatModelRef(SONNET), "claude-code/claude-sonnet-5-5");
});

test("handleSubagentToolCall: injeta modelo Antigravity quando o pai for Antigravity", async () => {
  const ctx = fakeCtx({ sessionModel: AG_GEMINI });
  const event = {
    tool: "subagent",
    sessionID: "s1",
    input: { agent: "worker", description: "UI fix", prompt: "ajuste" },
  };

  const handled = await handleSubagentToolCall(ctx, event);
  assert.equal(handled, true);
  assert.equal(event.input.model, "google/antigravity-gemini-3.8-flash#high");
});

test("handleSubagentToolCall: injeta modelo sem variant redundante quando ID já contém tier", async () => {
  const ctx = fakeCtx({ sessionModel: AG_GEMINI_HIGH_VAR });
  const event = {
    tool: "subagent",
    sessionID: "s1",
    input: { agent: "worker", description: "UI fix", prompt: "ajuste" },
  };

  const handled = await handleSubagentToolCall(ctx, event);
  assert.equal(handled, true);
  assert.equal(event.input.model, "google/antigravity-gemini-3.8-flash-high");
});

test("handleSubagentToolCall: injeta modelo agy quando o pai for agy", async () => {
  const ctx = fakeCtx({ sessionModel: AGY_FLASH });
  const event = {
    tool: "subagent",
    sessionID: "s1",
    input: { agent: "worker", description: "UI fix", prompt: "ajuste" },
  };

  const handled = await handleSubagentToolCall(ctx, event);
  assert.equal(handled, true);
  assert.equal(event.input.model, "agy/gemini-3.8-flash#high");
});

test("handleSubagentToolCall: não altera model se o pai for Claude/não-Antigravity", async () => {
  const ctx = fakeCtx({ sessionModel: NEW });
  const event = {
    tool: "subagent",
    sessionID: "s1",
    input: { agent: "worker", description: "UI fix", prompt: "ajuste" },
  };

  const handled = await handleSubagentToolCall(ctx, event);
  assert.equal(handled, false);
  assert.equal(event.input.model, undefined);
});

test("syncSessionModel: subagente com pai Antigravity herda modelo do pai", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker",
    sessionModel: SONNET,
    agentModel: SONNET,
    parentID: "p1",
    parentModel: AG_GEMINI,
  });

  const res = await syncSessionModel(ctx, "s1");
  assert.equal(res, "synced-subagent-antigravity");
  assert.deepEqual(ctx.switched, [AG_GEMINI]);
});

test("syncSessionModel: subagente com pai não-Antigravity mantém modelo default", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker",
    sessionModel: SONNET,
    agentModel: SONNET,
    parentID: "p1",
    parentModel: NEW,
  });

  const res = await syncSessionModel(ctx, "s1");
  assert.equal(res, "subagent-default");
  assert.deepEqual(ctx.switched, []);
});

test("syncSessionModel: subagente preso em gemini volta ao modelo do agente quando pai está em Claude", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker",
    sessionModel: AG_GEMINI,
    agentModel: SONNET,
    parentID: "p1",
    parentModel: NEW,
  });

  const res = await syncSessionModel(ctx, "s1");
  assert.equal(res, "subagent-restored");
  assert.deepEqual(ctx.switched, [SONNET]);
  assert.equal(ctx.store.get("synced-agent:s1"), syncMark("worker", SONNET));
});

test("syncSessionModel: subagente em gemini sem modelo no agente não troca nada", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker",
    sessionModel: AG_GEMINI,
    agentModel: undefined,
    parentID: "p1",
    parentModel: NEW,
  });

  const res = await syncSessionModel(ctx, "s1");
  assert.equal(res, "subagent-default");
  assert.deepEqual(ctx.switched, []);
});

test("syncSessionModel: subagente em gemini sem agente não troca nada", async () => {
  const ctx = fakeCtx({
    sessionAgent: null,
    sessionModel: AG_GEMINI,
    agentModel: SONNET,
    parentID: "p1",
    parentModel: NEW,
  });

  assert.equal(await syncSessionModel(ctx, "s1"), "subagent-default");
  assert.deepEqual(ctx.switched, []);
});

function resumeEvent(input) {
  return { tool: "subagent", sessionID: "p1", input: { agent: "worker", sessionID: "s1", prompt: "x", ...input } };
}

test("handleSubagentToolCall: retomada com pai Claude e alvo em gemini injeta modelo do agente", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker", sessionModel: AG_GEMINI, agentModel: SONNET, parentID: "p1", parentModel: NEW,
  });
  const event = resumeEvent({});
  assert.equal(await handleSubagentToolCall(ctx, event), true);
  assert.equal(event.input.model, "claude-code/claude-sonnet-5-5");
});

test("handleSubagentToolCall: model explícito do chamador é respeitado", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker", sessionModel: AG_GEMINI, agentModel: SONNET, parentID: "p1", parentModel: NEW,
  });
  const event = resumeEvent({ model: "claude-code/claude-haiku-4-5" });
  assert.equal(await handleSubagentToolCall(ctx, event), false);
  assert.equal(event.input.model, "claude-code/claude-haiku-4-5");
});

test("handleSubagentToolCall: pai Antigravity continua propagando na retomada", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker", sessionModel: SONNET, agentModel: SONNET, parentID: "p1", parentModel: AG_GEMINI,
  });
  const event = resumeEvent({});
  assert.equal(await handleSubagentToolCall(ctx, event), true);
  assert.equal(event.input.model, "google/antigravity-gemini-3.8-flash#high");
});

test("handleSubagentToolCall: agente sem modelo não injeta nada", async () => {
  const ctx = fakeCtx({
    sessionAgent: "worker", sessionModel: AG_GEMINI, agentModel: undefined, parentID: "p1", parentModel: NEW,
  });
  const event = resumeEvent({});
  assert.equal(await handleSubagentToolCall(ctx, event), false);
  assert.equal(event.input.model, undefined);
});

test("syncSessionModel: sessão primária em modelo Antigravity é preservada", async () => {
  const ctx = fakeCtx({
    sessionAgent: "orchestrator",
    sessionModel: AG_GEMINI_HIGH,
    agentModel: NEW,
  });

  const res = await syncSessionModel(ctx, "s1");
  assert.equal(res, "antigravity-preserved");
  assert.deepEqual(ctx.switched, []);
});

test("marca antiga (só agentID) gera resync único", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, mark: "orchestrator" });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, [NEW]);
  assert.equal(ctx.store.get("synced-agent:s1"), syncMark("orchestrator", NEW));
  await syncSessionModel(ctx, "s1");
  assert.equal(ctx.switched.length, 1);
});

test("modelo do agente mudou: troca o modelo da sessão", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, mark: syncMark("orchestrator", OLD) });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, [NEW]);
});

test("variant mudou: troca o modelo da sessão", async () => {
  const low = { ...NEW, variant: "low" };
  const ctx = fakeCtx({ agentModel: low, sessionModel: NEW, mark: syncMark("orchestrator", NEW) });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, [low]);
});

test("troca manual preservada se o agente não mudou", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: MANUAL, mark: syncMark("orchestrator", NEW) });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, []);
});

test("sessão nova sem marca recebe o modelo do agente", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: MANUAL });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, [NEW]);
});

test("sessão já no modelo do agente só grava a marca", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: NEW });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, []);
  assert.equal(ctx.store.get("synced-agent:s1"), syncMark("orchestrator", NEW));
});

test("agente sem model não faz nada", async () => {
  const ctx = fakeCtx({ agentModel: undefined, sessionModel: NEW });
  await syncSessionModel(ctx, "s1");
  assert.deepEqual(ctx.switched, []);
});

test("sessão sem agente não sincroniza nem chuta o 1º da lista", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: NEW, sessionAgent: null });
  const res = await syncSessionModel(ctx, "s1");
  assert.equal(res, "no-agent");
  assert.deepEqual(ctx.switched, []);
});

test("switchModel que lança não grava a marca", async () => {
  const ctx = fakeCtx({ agentModel: NEW, sessionModel: OLD, switchError: new Error("boom") });
  await assert.rejects(() => syncSessionModel(ctx, "s1"), /boom/);
  assert.equal(ctx.store.has("synced-agent:s1"), false);
});

const NEON_HIGH = { providerID: "google", id: "antigravity-gemini-4-neon-high" };
const NEON_XHIGH = { providerID: "google", id: "antigravity-gemini-4-neon-xhigh" };
const NEON_LOW = { providerID: "google", id: "antigravity-gemini-4-neon-low" };
const NEON_BARE_XHIGH = { providerID: "google", id: "antigravity-gemini-4-neon", variant: "xhigh" };
const AG_OPUS_55_HIGH = { providerID: "google", id: "antigravity-claude-opus-5-5-high" };
const AG_OPUS_55_LOW = { providerID: "google", id: "antigravity-claude-opus-5-5-low" };
const HYDROGEN_MED = { providerID: "google", id: "antigravity-gemini-4-hydrogen-medium" };
const HYDROGEN_HIGH = { providerID: "google", id: "antigravity-gemini-4-hydrogen-high" };
const HYDROGEN_LOW = { providerID: "google", id: "antigravity-gemini-4-hydrogen-low" };
const AG_SONNET_55_MED = { providerID: "google", id: "antigravity-claude-sonnet-5-5-medium" };
const AG_SONNET_55_LOW = { providerID: "google", id: "antigravity-claude-sonnet-5-5-low" };
const WEBAPI_S55 = { providerID: "webapi", id: "sonnet-5.5" };

test("resolveSubagentModel: Neon High roteia workers para Hydrogen Medium", () => {
  for (const agent of ["worker", "backend", "tester", "devops", "docs-writer", "agentic"]) {
    assert.deepEqual(resolveSubagentModel(NEON_HIGH, agent), HYDROGEN_MED);
  }
});

test("resolveSubagentModel: Neon High roteia agentes rápidos para Hydrogen Low", () => {
  for (const agent of ["explore", "general", "browser"]) {
    assert.deepEqual(resolveSubagentModel(NEON_HIGH, agent), HYDROGEN_LOW);
  }
});

test("resolveSubagentModel: Neon High mantém Neon para agentes de raciocínio crítico", () => {
  for (const agent of ["architect", "debugger", "reviewer", "blue-team"]) {
    assert.deepEqual(resolveSubagentModel(NEON_HIGH, agent), NEON_HIGH);
  }
});

test("resolveSubagentModel: Neon XHigh→Hydrogen High, Neon Low→Hydrogen Low e variant sem sufixo", () => {
  assert.deepEqual(resolveSubagentModel(NEON_XHIGH, "worker"), HYDROGEN_HIGH);
  assert.deepEqual(resolveSubagentModel(NEON_BARE_XHIGH, "worker"), HYDROGEN_HIGH);
  assert.deepEqual(resolveSubagentModel(NEON_LOW, "worker"), HYDROGEN_LOW);
  assert.deepEqual(resolveSubagentModel({ providerID: "google", id: "antigravity-gemini-4-neon" }, "worker"), HYDROGEN_MED);
});

test("resolveSubagentModel: Antigravity Claude Opus 5.5 roteia worker→Sonnet 5.5 e mantém architect", () => {
  assert.deepEqual(resolveSubagentModel(AG_OPUS_55_HIGH, "worker"), AG_SONNET_55_MED);
  assert.deepEqual(resolveSubagentModel(AG_OPUS_55_LOW, "worker"), AG_SONNET_55_LOW);
  for (const agent of ["architect", "debugger", "reviewer", "blue-team"]) {
    assert.deepEqual(resolveSubagentModel(AG_OPUS_55_HIGH, agent), AG_OPUS_55_HIGH);
  }
});

test("resolveSubagentModel: outros modelos Antigravity/WebApi e null permanecem intactos", () => {
  assert.equal(resolveSubagentModel(null, "worker"), null);
  assert.deepEqual(resolveSubagentModel(AG_GEMINI, "worker"), AG_GEMINI);
  assert.deepEqual(resolveSubagentModel(HYDROGEN_MED, "worker"), HYDROGEN_MED);
  assert.deepEqual(resolveSubagentModel(AGY_FLASH, "worker"), AGY_FLASH);
  assert.deepEqual(resolveSubagentModel(WEBAPI_S55, "worker"), WEBAPI_S55);
});

test("handleSubagentToolCall: aplica tier routing e respeita override explícito da mesma família", async () => {
  const ctx = fakeCtx({ sessionModel: NEON_HIGH });

  const workerEv = { tool: "subagent", sessionID: "s1", input: { agent: "worker", prompt: "x" } };
  assert.equal(await handleSubagentToolCall(ctx, workerEv), true);
  assert.equal(workerEv.input.model, "google/antigravity-gemini-4-hydrogen-medium");

  const exploreEv = { tool: "subagent", sessionID: "s1", input: { agent: "explore", prompt: "x" } };
  assert.equal(await handleSubagentToolCall(ctx, exploreEv), true);
  assert.equal(exploreEv.input.model, "google/antigravity-gemini-4-hydrogen-low");

  const archEv = { tool: "subagent", sessionID: "s1", input: { agent: "architect", prompt: "x" } };
  assert.equal(await handleSubagentToolCall(ctx, archEv), true);
  assert.equal(archEv.input.model, "google/antigravity-gemini-4-neon-high");

  const overrideEv = {
    tool: "subagent", sessionID: "s1",
    input: { agent: "worker", model: "google/antigravity-gemini-4-neon-high", prompt: "x" },
  };
  assert.equal(await handleSubagentToolCall(ctx, overrideEv), false);
  assert.equal(overrideEv.input.model, "google/antigravity-gemini-4-neon-high");
});

test("handleSubagentToolCall: override não-Antigravity com pai Antigravity aplica resolveSubagentModel", async () => {
  const ctx = fakeCtx({ sessionModel: NEON_HIGH });
  const ev = {
    tool: "subagent", sessionID: "s1",
    input: { agent: "worker", model: "claude-code/claude-sonnet-5-5", prompt: "x" },
  };
  assert.equal(await handleSubagentToolCall(ctx, ev), true);
  assert.equal(ev.input.model, "google/antigravity-gemini-4-hydrogen-medium");

  const webCtx = fakeCtx({ sessionModel: WEBAPI_S55 });
  const webOverride = {
    tool: "subagent", sessionID: "s1",
    input: { agent: "worker", model: "webapi/sonnet-5.5-high", prompt: "x" },
  };
  assert.equal(await handleSubagentToolCall(webCtx, webOverride), false);
  assert.equal(webOverride.input.model, "webapi/sonnet-5.5-high");
});

test("syncSessionModel: respeita override Antigravity no subagente e aplica tier quando veio em Claude", async () => {
  const overrideCtx = fakeCtx({
    sessionAgent: "worker", sessionModel: NEON_HIGH, agentModel: SONNET,
    parentID: "p1", parentModel: NEON_HIGH,
  });
  assert.equal(await syncSessionModel(overrideCtx, "s1"), "antigravity-preserved");
  assert.deepEqual(overrideCtx.switched, []);
  assert.equal(overrideCtx.store.get("synced-agent:s1"), syncMark("worker", NEON_HIGH));
  assert.equal(await syncSessionModel(overrideCtx, "s1"), "in-sync");

  const fallbackCtx = fakeCtx({
    sessionAgent: "worker", sessionModel: SONNET, agentModel: SONNET,
    parentID: "p1", parentModel: NEON_HIGH,
  });
  assert.equal(await syncSessionModel(fallbackCtx, "s1"), "synced-subagent-antigravity");
  assert.deepEqual(fallbackCtx.switched, [HYDROGEN_MED]);
  assert.equal(fallbackCtx.store.get("synced-agent:s1"), syncMark("worker", HYDROGEN_MED));
});

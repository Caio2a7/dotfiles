export const REASONING_AGENTS = new Set(["architect", "debugger", "reviewer", "blue-team"]);
export const FAST_AGENTS = new Set(["explore", "general", "browser"]);

const NEON_MODEL_RE = /^antigravity-gemini-4-neon(?:-(low|medium|high|xhigh))?$/i;
const OPUS_55_MODEL_RE = /^antigravity-claude-opus-5-5(?:-(low|medium|high))?$/i;

export function sameModel(a, b) {
  return Boolean(a && b) && a.providerID === b.providerID && a.id === b.id
    && (a.variant ?? null) === (b.variant ?? null);
}

/** Marca de sincronização: agente + modelo configurado (id e variant). */
export function syncMark(agentID, model) {
  return `${agentID}|${model.providerID}/${model.id}#${model.variant ?? ""}`;
}

/** Verifica se um modelo pertence à família Antigravity (Google / agy / gemini). */
export function isAntigravityModel(model) {
  if (!model) return false;
  if (typeof model === "string") {
    const s = model.toLowerCase();
    return s.startsWith("google/") || s.startsWith("agy/") || s.startsWith("antigravity/")
      || s.includes("antigravity") || s.includes("gemini");
  }
  const provider = (model.providerID || model.provider || "").toLowerCase();
  const id = (model.id || model.model || "").toLowerCase();
  return provider === "google" || provider === "agy" || provider === "antigravity"
    || id.startsWith("antigravity-") || id.includes("antigravity")
    || id.startsWith("gemini") || id.includes("gemini");
}

/** Verifica se um modelo pertence à família WebApi (providerID === 'webapi' ou model string/id contém 'webapi', 'sonnet-5.5', 'sonnet-5.5-high', 'sonnet-5.5-extra', 's4'). */
export function isWebApiModel(model) {
  if (!model) return false;
  const webapiKeywords = ["webapi", "sonnet-5.5", "sonnet-5.5-high", "sonnet-5.5-extra", "s4"];
  if (typeof model === "string") {
    const s = model.toLowerCase();
    return webapiKeywords.some((k) => s.includes(k));
  }
  const provider = (model.providerID || model.provider || "").toLowerCase();
  const id = (model.id || model.model || "").toLowerCase();
  return provider === "webapi" || webapiKeywords.some((k) => id.includes(k));
}

/** Verifica se dois modelos pertencem à mesma família (ambos Antigravity ou ambos WebApi). */
function sameModelFamily(parentModel, candidate) {
  if (!parentModel || !candidate) return false;
  if (isAntigravityModel(parentModel) && isAntigravityModel(candidate)) return true;
  if (isWebApiModel(parentModel) && isWebApiModel(candidate)) return true;
  return false;
}

function mapNeonTier(rawTier) {
  const tier = String(rawTier || "").toLowerCase();
  if (tier === "xhigh") return "high";
  if (tier === "low") return "low";
  return "medium";
}

/**
 * Resolve o modelo-alvo de um subagente a partir do modelo do pai e do papel (agentID).
 * Aplica roteamento por tier para Gemini 4 Neon e Antigravity Claude Opus 5.5;
 * demais modelos Antigravity/WebApi são preservados intactos.
 */
export function resolveSubagentModel(parentModel, agentID) {
  if (!parentModel) return parentModel;
  const providerID = parentModel.providerID || parentModel.provider || "google";
  const id = String(parentModel.id || parentModel.model || "");

  const neonMatch = id.match(NEON_MODEL_RE);
  if (neonMatch) {
    if (agentID && REASONING_AGENTS.has(agentID)) return parentModel;
    if (agentID && FAST_AGENTS.has(agentID)) {
      return { providerID, id: "antigravity-gemini-4-hydrogen-low" };
    }
    const tier = mapNeonTier(neonMatch[1] || parentModel.variant);
    return { providerID, id: `antigravity-gemini-4-hydrogen-${tier}` };
  }

  const opusMatch = id.match(OPUS_55_MODEL_RE);
  if (opusMatch) {
    if (agentID && REASONING_AGENTS.has(agentID)) return parentModel;
    const rawTier = String(opusMatch[1] || parentModel.variant || "").toLowerCase();
    const tier = rawTier === "low" ? "low" : "medium";
    return { providerID, id: `antigravity-claude-sonnet-5-5-${tier}` };
  }

  return parentModel;
}

/** Formata objeto de modelo para string providerID/modelID ou providerID/modelID#variant. */
export function formatModelRef(model) {
  if (typeof model === "string") return model;
  const provider = model.providerID || model.provider || "google";
  const id = model.id || model.model;
  const variant = model.variant;
  if (!variant || variant === "default" || id.endsWith(`-${variant}`)) {
    return `${provider}/${id}`;
  }
  return `${provider}/${id}#${variant}`;
}

/**
 * Intercepta chamadas da ferramenta subagent: se o pai rodar em modelo Antigravity ou WebApi,
 * roteia por papel/tier (respeitando overrides explícitos da mesma família).
 */
export async function handleSubagentToolCall(ctx, event) {
  if (event.tool !== "subagent" || !event.input) return false;
  const parent = await ctx.session.get({ sessionID: event.sessionID });
  if (parent?.model && (isAntigravityModel(parent.model) || isWebApiModel(parent.model))) {
    if (event.input.model && sameModelFamily(parent.model, event.input.model)) {
      return false;
    }
    const target = resolveSubagentModel(parent.model, event.input.agent);
    event.input.model = formatModelRef(target);
    return true;
  }
  return restoreResumedModel(ctx, event.input);
}

/**
 * Retomada de subagente com pai não-Antigravity/não-WebApi: se a sessão-alvo ficou presa em
 * modelo Antigravity ou WebApi e o chamador não passou model, injeta o modelo configurado do agente.
 */
async function restoreResumedModel(ctx, input) {
  if (input.model || !input.sessionID || !input.agent) return false;
  const target = await ctx.session.get({ sessionID: input.sessionID });
  if (!isAntigravityModel(target?.model) && !isWebApiModel(target?.model)) return false;
  const agentModel = await configuredAgentModel(ctx, input.agent);
  if (!agentModel) return false;
  input.model = formatModelRef(agentModel);
  return true;
}

async function configuredAgentModel(ctx, agentID) {
  const { data: agent } = await ctx.agent.get({ agentID });
  return agent?.model ?? null;
}

/** Pai saiu de Antigravity/WebApi: devolve o subagente ao modelo configurado do seu agente. */
async function restoreSubagentModel(ctx, sessionID, session) {
  if (!session.agent || (!isAntigravityModel(session.model) && !isWebApiModel(session.model))) return "subagent-default";
  const agentModel = await configuredAgentModel(ctx, session.agent);
  if (!agentModel) return "subagent-default";
  await ctx.session.switchModel({ sessionID, model: agentModel });
  await ctx.storage.set(`synced-agent:${sessionID}`, syncMark(session.agent, agentModel));
  return "subagent-restored";
}

/** Sincroniza sessão de subagente com roteamento por papel/tier quando o pai é Antigravity/WebApi. */
async function syncSubagentModel(ctx, sessionID, session) {
  const parent = await ctx.session.get({ sessionID: session.parentID });
  if (!parent?.model || (!isAntigravityModel(parent.model) && !isWebApiModel(parent.model))) {
    return restoreSubagentModel(ctx, sessionID, session);
  }
  const key = `synced-agent:${sessionID}`;
  const agentLabel = session.agent || "subagent";
  const existingMark = await ctx.storage.get(key);

  if (sameModelFamily(parent.model, session.model)) {
    const currentMark = syncMark(agentLabel, session.model);
    if (existingMark === currentMark) return "in-sync";
    await ctx.storage.set(key, currentMark);
    return "antigravity-preserved";
  }

  const target = resolveSubagentModel(parent.model, session.agent);
  const mark = syncMark(agentLabel, target);
  if (existingMark === mark) return "in-sync";
  if (!sameModel(target, session.model)) {
    await ctx.session.switchModel({ sessionID, model: target });
  }
  await ctx.storage.set(key, mark);
  return "synced-subagent-antigravity";
}

/**
 * Sincroniza o modelo da sessão com o do agente ou pai (subagente herdando Antigravity/WebApi).
 */
export async function syncSessionModel(ctx, sessionID) {
  const session = await ctx.session.get({ sessionID });
  if (!session) return "no-session";
  if (session.parentID) return syncSubagentModel(ctx, sessionID, session);

  // Sessão primária (sem parentID)
  const agentID = session.agent;
  if (!agentID) return "no-agent";

  // Se a sessão primária já está rodando num modelo Antigravity ou WebApi, preserva
  if (isAntigravityModel(session.model) || isWebApiModel(session.model)) {
    const key = `synced-agent:${sessionID}`;
    const mark = syncMark(agentID, session.model);
    await ctx.storage.set(key, mark);
    return "antigravity-preserved";
  }

  const { data: agent } = await ctx.agent.get({ agentID });
  if (!agent?.model) return "no-model";

  const key = `synced-agent:${sessionID}`;
  const mark = syncMark(agentID, agent.model);
  if ((await ctx.storage.get(key)) === mark) return "in-sync";
  if (!sameModel(agent.model, session.model)) {
    await ctx.session.switchModel({ sessionID, model: agent.model });
  }
  await ctx.storage.set(key, mark);
  return "synced";
}

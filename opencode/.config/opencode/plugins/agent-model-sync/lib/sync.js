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
 * Intercepta chamadas da ferramenta subagent: se o pai rodar em modelo Antigravity,
 * propaga o mesmo modelo ao subagente no parâmetro de entrada da ferramenta.
 */
export async function handleSubagentToolCall(ctx, event) {
  if (event.tool !== "subagent" || !event.input) return false;
  const parent = await ctx.session.get({ sessionID: event.sessionID });
  if (parent?.model && isAntigravityModel(parent.model)) {
    event.input.model = formatModelRef(parent.model);
    return true;
  }
  return restoreResumedModel(ctx, event.input);
}

/**
 * Retomada de subagente com pai não-Antigravity: se a sessão-alvo ficou presa em
 * modelo Antigravity e o chamador não passou model, injeta o modelo configurado do agente.
 */
async function restoreResumedModel(ctx, input) {
  if (input.model || !input.sessionID || !input.agent) return false;
  const target = await ctx.session.get({ sessionID: input.sessionID });
  if (!isAntigravityModel(target?.model)) return false;
  const agentModel = await configuredAgentModel(ctx, input.agent);
  if (!agentModel) return false;
  input.model = formatModelRef(agentModel);
  return true;
}

async function configuredAgentModel(ctx, agentID) {
  const { data: agent } = await ctx.agent.get({ agentID });
  return agent?.model ?? null;
}

/** Pai saiu de Antigravity: devolve o subagente ao modelo configurado do seu agente. */
async function restoreSubagentModel(ctx, sessionID, session) {
  if (!session.agent || !isAntigravityModel(session.model)) return "subagent-default";
  const agentModel = await configuredAgentModel(ctx, session.agent);
  if (!agentModel) return "subagent-default";
  await ctx.session.switchModel({ sessionID, model: agentModel });
  await ctx.storage.set(`synced-agent:${sessionID}`, syncMark(session.agent, agentModel));
  return "subagent-restored";
}

/**
 * Sincroniza o modelo da sessão com o do agente ou pai (subagente herdando Antigravity).
 */
export async function syncSessionModel(ctx, sessionID) {
  const session = await ctx.session.get({ sessionID });
  if (!session) return "no-session";

  // Se for sessão de subagente (possui parentID):
  if (session.parentID) {
    const parent = await ctx.session.get({ sessionID: session.parentID });
    if (parent?.model && isAntigravityModel(parent.model)) {
      const key = `synced-agent:${sessionID}`;
      const mark = syncMark(session.agent || "subagent", parent.model);
      if ((await ctx.storage.get(key)) === mark) return "in-sync";
      if (!sameModel(parent.model, session.model)) {
        await ctx.session.switchModel({ sessionID, model: parent.model });
      }
      await ctx.storage.set(key, mark);
      return "synced-subagent-antigravity";
    }
    return restoreSubagentModel(ctx, sessionID, session);
  }

  // Sessão primária (sem parentID)
  const agentID = session.agent;
  if (!agentID) return "no-agent";

  // Se a sessão primária já está rodando num modelo Antigravity, preserva
  if (isAntigravityModel(session.model)) {
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

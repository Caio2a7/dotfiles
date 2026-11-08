function sameModel(a, b) {
  return Boolean(a && b) && a.providerID === b.providerID && a.id === b.id
    && (a.variant ?? null) === (b.variant ?? null);
}

/** Marca de sincronização: agente + modelo configurado (id e variant). */
export function syncMark(agentID, model) {
  return `${agentID}|${model.providerID}/${model.id}#${model.variant ?? ""}`;
}

/**
 * Sincroniza o modelo da sessão com o do agente. Retorna "no-agent" quando a
 * sessão não declara agente: a API V2 não expõe o agente padrão nem garante a
 * ordem de `agent.list()`, então nunca se aplica modelo por palpite.
 */
export async function syncSessionModel(ctx, sessionID) {
  const session = await ctx.session.get({ sessionID });
  const agentID = session.agent;
  if (!agentID) return "no-agent";
  const { data: agent } = await ctx.agent.get({ agentID });
  if (!agent.model) return "no-model";
  const key = `synced-agent:${sessionID}`;
  const mark = syncMark(agentID, agent.model);
  if ((await ctx.storage.get(key)) === mark) return "in-sync";
  if (!sameModel(agent.model, session.model)) {
    await ctx.session.switchModel({ sessionID, model: agent.model });
  }
  await ctx.storage.set(key, mark);
  return "synced";
}

function sameModel(a, b) {
  return Boolean(a && b) && a.providerID === b.providerID && a.id === b.id
    && (a.variant ?? null) === (b.variant ?? null);
}

/** Marca de sincronização: agente + modelo configurado (id e variant). */
export function syncMark(agentID, model) {
  return `${agentID}|${model.providerID}/${model.id}#${model.variant ?? ""}`;
}

async function resolveAgentID(ctx, session) {
  if (session.agent) return session.agent;
  const { data } = await ctx.agent.list();
  return data[0]?.id;
}

export async function syncSessionModel(ctx, sessionID) {
  const session = await ctx.session.get({ sessionID });
  const agentID = await resolveAgentID(ctx, session);
  if (!agentID) return;
  const { data: agent } = await ctx.agent.get({ agentID });
  if (!agent.model) return;
  const key = `synced-agent:${sessionID}`;
  const mark = syncMark(agentID, agent.model);
  if ((await ctx.storage.get(key)) === mark) return;
  if (!sameModel(agent.model, session.model)) {
    await ctx.session.switchModel({ sessionID, model: agent.model });
  }
  await ctx.storage.set(key, mark);
}

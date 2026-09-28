/**
 * agent-model-sync — faz agentes primários rodarem no próprio modelo (V2).
 *
 * No OpenCode 2.0.x o runner usa só o modelo gravado na sessão (ou o padrão
 * global) e ignora `model` dos agentes primários; subagentes já funcionam.
 * Refs: anomalyco/opencode#49765, weave-io/weave#271.
 *
 * Regra (igual à V1): quando a sessão começa ou troca de agente, aplica o
 * modelo do agente. Uma troca manual de modelo depois disso é preservada
 * até a próxima troca de agente. O último agente sincronizado por sessão
 * fica no storage do plugin, para sobreviver a reinícios do serviço.
 */
function sameModel(a, b) {
  return Boolean(a && b) && a.providerID === b.providerID && a.id === b.id
    && (a.variant ?? null) === (b.variant ?? null);
}

async function resolveAgentID(ctx, session) {
  if (session.agent) return session.agent;
  const { data } = await ctx.agent.list();
  return data[0]?.id;
}

async function syncSessionModel(ctx, sessionID) {
  const session = await ctx.session.get({ sessionID });
  const agentID = await resolveAgentID(ctx, session);
  if (!agentID) return;
  const key = `synced-agent:${sessionID}`;
  if ((await ctx.storage.get(key)) === agentID) return;
  const { data: agent } = await ctx.agent.get({ agentID });
  if (agent.model && !sameModel(agent.model, session.model)) {
    await ctx.session.switchModel({ sessionID, model: agent.model });
  }
  await ctx.storage.set(key, agentID);
}

export default {
  id: "local.agent-model-sync",
  async setup(ctx) {
    await ctx.session.hook("prompt", async (event) => {
      try {
        await syncSessionModel(ctx, event.sessionID);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[agent-model-sync] sessão ${event.sessionID}: modelo do agente não aplicado (${reason})`);
      }
    });
  },
};

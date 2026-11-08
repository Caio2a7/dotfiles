/**
 * agent-model-sync — faz agentes primários rodarem no próprio modelo (V2).
 *
 * No OpenCode 2.0.x o runner usa só o modelo gravado na sessão (ou o padrão
 * global) e ignora `model` dos agentes primários; subagentes já funcionam.
 * Refs: anomalyco/opencode#49765, weave-io/weave#271.
 *
 * Regra: o modelo configurado do agente é aplicado à sessão quando ela começa,
 * quando troca de agente ou quando o modelo configurado (id ou variant) muda.
 * Uma troca manual de modelo é preservada enquanto nada disso ocorrer.
 * A marca por sessão (`agentID|provider/model#variant`) fica no storage do
 * plugin, para sobreviver a reinícios do serviço. Marcas do formato antigo
 * (só `agentID`) nunca casam: cada sessão existente ganha um resync único.
 *
 * Hook `prompt`: roda na admissão do prompt, antes de o turno resolver o
 * modelo, então o 1º turno após um restart/upgrade já usa o modelo novo.
 */
import { syncSessionModel } from "./lib/sync.js";

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

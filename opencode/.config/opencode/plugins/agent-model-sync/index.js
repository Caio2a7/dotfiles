/**
 * agent-model-sync — sincronização de modelos de agentes e subagentes (V2).
 *
 * 1. Agentes primários: aplica o modelo configurado à sessão (workaround #49765),
 *    preservando modelos Antigravity ativos ou trocas manuais.
 * 2. Subagentes disparados pelo orchestrator: quando o orchestrator estiver rodando
 *    em QUALQUER modelo Antigravity (ex.: Gemini 3.8 Flash), os subagentes herdam
 *    o mesmo modelo Antigravity. Caso contrário, rodam no padrão configurado (Sonnet 5.5).
 */
import { handleSubagentToolCall, syncSessionModel } from "./lib/sync.js";

export default {
  id: "local.agent-model-sync",
  async setup(ctx) {
    // Intercepta a chamada da ferramenta subagent antes da execução para injetar o modelo Antigravity
    await ctx.tool.hook("execute.before", async (event) => {
      try {
        await handleSubagentToolCall(ctx, event);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[agent-model-sync] subagent tool hook falhou (${reason})`);
      }
    });

    // Sincroniza modelos de sessão no início do prompt
    await ctx.session.hook("prompt", async (event) => {
      try {
        const status = await syncSessionModel(ctx, event.sessionID);
        if (status === "no-agent") {
          console.warn(`[agent-model-sync] sessão ${event.sessionID}: sem agente na sessão; modelo não sincronizado`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[agent-model-sync] sessão ${event.sessionID}: modelo do agente não aplicado (${reason})`);
      }
    });
  },
};

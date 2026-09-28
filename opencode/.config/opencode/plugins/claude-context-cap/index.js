/**
 * claude-context-cap — limita a janela de contexto dos modelos claude-code.
 *
 * Opus 5.5 e Fable 5.1 só existem na variante de 1M. Cada passo do loop
 * relê o contexto inteiro (via cache), então deixar a sessão crescer até
 * perto de 1M consome a cota da assinatura muito rápido. Reduzindo o limite
 * anunciado ao OpenCode, a compactação dele dispara antes e o plugin
 * opencode-claude recomeça a sessão Claude a partir do resumo.
 *
 * Opções (opencode.json): { "package": "./plugins/claude-context-cap",
 *                           "options": { "maxContext": 200000 } }
 */
const PROVIDER_ID = "claude-code";
const DEFAULT_MAX_CONTEXT = 200_000;

function resolveMaxContext(options) {
  const value = options?.maxContext;
  if (value === undefined) return DEFAULT_MAX_CONTEXT;
  if (!Number.isInteger(value) || value < 32_000) {
    throw new Error(`claude-context-cap: maxContext inválido (${value}); use um inteiro >= 32000`);
  }
  return value;
}

export default {
  id: "local.claude-context-cap",
  async setup(ctx) {
    const maxContext = resolveMaxContext(ctx.options);
    await ctx.model.transform((editor) => {
      for (const model of editor.list(PROVIDER_ID)) {
        if (model.limit.context <= maxContext) continue;
        editor.update(PROVIDER_ID, model.id, (m) => {
          m.limit.context = maxContext;
          // Variantes 1M anunciam input ~900k, que a compactação usaria no
          // lugar do contexto; sem ele, comportam-se como os modelos 200k.
          delete m.limit.input;
        });
      }
    });
  },
};

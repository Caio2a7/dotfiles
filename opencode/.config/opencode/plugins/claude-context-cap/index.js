/**
 * claude-context-cap — limita a janela de contexto por provider (modelos 1M).
 *
 * Cada passo do loop relê o contexto inteiro (via cache), então deixar a
 * sessão crescer até perto de 1M consome cota e latência muito rápido.
 * Reduzindo o limite anunciado ao OpenCode, a compactação dispara antes.
 *
 * Opções (opencode.json):
 *   { "package": "./plugins/claude-context-cap",
 *     "options": { "providers": { "claude-code": 200000, "google": 300000 } } }
 */
const DEFAULT_PROVIDERS = ["claude-code", "google"];
const DEFAULT_MAX_CONTEXT = 200_000;

function assertValidCap(value, label) {
  if (!Number.isInteger(value) || value < 32_000) {
    throw new Error(`claude-context-cap: ${label} inválido (${value}); use um inteiro >= 32000`);
  }
  return value;
}

export function resolveLimits(options) {
  const fallback = options?.maxContext === undefined
    ? DEFAULT_MAX_CONTEXT
    : assertValidCap(options.maxContext, "maxContext");

  if (!options?.providers) {
    return Object.fromEntries(DEFAULT_PROVIDERS.map((p) => [p, fallback]));
  }
  if (typeof options.providers !== "object" || Array.isArray(options.providers)) {
    throw new Error("claude-context-cap: providers deve ser um objeto { providerID: maxContext }");
  }
  return Object.fromEntries(
    Object.entries(options.providers).map(([p, v]) => [p, assertValidCap(v, `providers.${p}`)]),
  );
}

export default {
  id: "local.claude-context-cap",
  async setup(ctx) {
    const limits = resolveLimits(ctx.options);
    await ctx.model.transform((editor) => {
      for (const [providerID, maxContext] of Object.entries(limits)) {
        for (const model of editor.list(providerID)) {
          if (model.limit.context <= maxContext) continue;
          editor.update(providerID, model.id, (m) => {
            m.limit.context = maxContext;
            // Variantes 1M anunciam input ~900k, que a compactação usaria no
            // lugar do contexto; sem ele, respeitam limit.context.
            delete m.limit.input;
          });
        }
      }
    });
  },
};

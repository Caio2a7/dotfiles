import { test } from "node:test";
import assert from "node:assert/strict";
import plugin, { resolveLimits } from "../index.js";

test("resolveLimits usa fallback padrão e maxContext legado", () => {
  assert.deepEqual(resolveLimits(undefined), { "claude-code": 200000, google: 200000 });
  assert.deepEqual(resolveLimits({ maxContext: 250000 }), { "claude-code": 250000, google: 250000 });
});

test("resolveLimits aceita limites distintos por provider", () => {
  assert.deepEqual(
    resolveLimits({ providers: { "claude-code": 200000, google: 300000 } }),
    { "claude-code": 200000, google: 300000 },
  );
});

test("resolveLimits rejeita valores inválidos", () => {
  assert.throws(() => resolveLimits({ maxContext: 10000 }), /inválido/);
  assert.throws(() => resolveLimits({ providers: [] }), /objeto/);
  assert.throws(() => resolveLimits({ providers: { google: "300000" } }), /providers\.google/);
});

test("setup aplica caps por provider e remove limit.input", async () => {
  const models = {
    "claude-code": [
      { id: "opus-1m", limit: { context: 1_000_000, input: 900_000 } },
      { id: "haiku", limit: { context: 128_000, input: 100_000 } },
    ],
    google: [{ id: "gemini-1m", limit: { context: 1_048_576, input: 900_000 } }],
  };
  const editor = {
    list: (p) => models[p] ?? [],
    update: (p, id, fn) => fn(models[p].find((m) => m.id === id)),
  };

  await plugin.setup({
    options: { providers: { "claude-code": 200000, google: 300000 } },
    model: { transform: async (fn) => fn(editor) },
  });

  assert.deepEqual(models["claude-code"][0].limit, { context: 200000 });
  assert.deepEqual(models["claude-code"][1].limit, { context: 128000, input: 100000 });
  assert.deepEqual(models.google[0].limit, { context: 300000 });
});

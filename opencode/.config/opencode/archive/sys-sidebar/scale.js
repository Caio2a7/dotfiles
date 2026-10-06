// Escalas de cor derivadas do tema: interpolação linear entre tokens (resultado em string hex aceita por fg/titleColor).
export const USAGE_HIGH = 65
const USAGE_WARN = 80
const USAGE_CRIT = 92
const TEMP_WARN = 60
const TEMP_HOT = 75
const TEMP_CRIT = 85

const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0")
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

// Interpolação linear entre duas cores do tema (RGBA com toInts()); t em [0, 1].
export function lerp(from, to, t) {
  const k = Math.max(0, Math.min(1, t))
  const [r1, g1, b1] = from.toInts()
  const [r2, g2, b2] = to.toInts()
  return toHex([r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k])
}

// Cor em v ao longo de pontos [[x, cor], ...] ordenados por x; fora do intervalo, trava nas pontas.
export function stops(points, v) {
  const last = points[points.length - 1]
  if (v >= last[0]) return lerp(last[1], last[1], 0)
  if (v <= points[0][0]) return lerp(points[0][1], points[0][1], 0)
  const i = points.findIndex(([x]) => v < x)
  const [x0, c0] = points[i - 1]
  const [x1, c1] = points[i]
  return lerp(c0, c1, (v - x0) / (x1 - x0))
}

// Rosa claro: não há token rosa no tema; mistura roxo→erro.
export const pinkOf = (c) => ({ toInts: () => hexToInts(lerp(c.purple, c.error, 0.4)) })
const hexToInts = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

// Pontos da faixa baixa (0..65) por tipo; CPU/RAM verde → amarelo, GPU/VRAM roxo → rosa (meio) → amarelo.
const lowStops = (c, kind) => ({
  cpu: [[0, c.success], [USAGE_HIGH, c.yellow]],
  ram: [[0, c.success], [USAGE_HIGH, c.yellow]],
  gpu: [[0, c.purple], [USAGE_HIGH / 2, pinkOf(c)], [USAGE_HIGH, c.yellow]],
  vram: [[0, c.purple], [USAGE_HIGH / 2, pinkOf(c)], [USAGE_HIGH, c.yellow]],
  disk: [[0, c.base], [USAGE_HIGH, c.base]],
})[kind]

// Cor da barra/percentual por valor: faixa baixa por tipo; a partir de 65% amarelo → laranja → vermelho.
export function usageColor(c, kind, v) {
  if (v >= USAGE_HIGH) return stops([[USAGE_HIGH, c.yellow], [USAGE_WARN, c.warning], [USAGE_CRIT, c.error]], v)
  return stops(lowStops(c, kind), v)
}

// Temperatura: < 60 °C neutro; 60 amarelo → 75 laranja → 85 vermelho.
export function tempColor(c, temp) {
  if (temp < TEMP_WARN) return lerp(c.muted, c.muted, 0)
  return stops([[TEMP_WARN, c.yellow], [TEMP_HOT, c.warning], [TEMP_CRIT, c.error]], temp)
}

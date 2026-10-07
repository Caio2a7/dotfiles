export const CELL_WIDTH = 9

import { USAGE_HIGH, tempColor, usageColor } from "./scale.js"

// Tokens do tema ativo (RGBA); nenhuma cor fixa.
export const palette = (theme) => ({
  border: theme.border.base,
  title: theme.text.muted,
  label: theme.text.muted,
  value: theme.text.base,
  base: theme.text.base,
  muted: theme.text.muted,
  track: theme.border.base,
  success: theme.text.feedback.success.base,
  warning: theme.text.feedback.warning.base,
  yellow: theme.syntax.type,
  error: theme.text.feedback.error.base,
  purple: theme.syntax.keyword,
  net: theme.text.feedback.info.base,
})
const BAR_CHAR = "━"
const HALF_CHAR = "╸"
const TRACK_CHAR = "─"

const known = (n) => n != null && Number.isFinite(n)
const clamp = (p) => Math.max(0, Math.min(100, p))
const seg = (t, fg, bold = false) => ({ t, fg, bold })

export function barSegments(colors, percent, accent) {
  const halves = known(percent) ? Math.round((clamp(percent) / 100) * CELL_WIDTH * 2) : 0
  const full = halves >> 1
  const half = halves & 1
  const filled = BAR_CHAR.repeat(full) + (half ? HALF_CHAR : "")
  const segs = []
  if (filled) segs.push(seg(filled, accent))
  segs.push(seg(TRACK_CHAR.repeat(CELL_WIDTH - full - half), colors.track))
  return segs
}

const percentValue = (colors, percent, accent) =>
  known(percent)
    ? seg(`${Math.round(percent)}%`, percent >= USAGE_HIGH ? accent : colors.value, true)
    : seg("—", colors.muted)

const rateValue = (colors, rate) =>
  known(rate) ? seg(formatRate(rate), colors.value, true) : seg("—", colors.muted)

function labelSegments(colors, label, value) {
  const pad = Math.max(0, CELL_WIDTH - label.length - value.t.length)
  return [seg(label, colors.label), seg(" ".repeat(pad)), value]
}

// Taxa em até 5 colunas: 0K, NNNK, N.NM, NNM.
export function formatRate(bps) {
  if (bps < 1024) return "0K"
  if (bps < 1024 * 1024) return `${Math.round(bps / 1024)}K`
  const mb = bps / (1024 * 1024)
  return mb < 10 ? `${mb.toFixed(1)}M` : `${Math.round(mb)}M`
}

// Célula: { label, bar } com segmentos [{ t, fg, bold }] de exatamente CELL_WIDTH colunas.
export function cell(colors, label, accent, percent, value = percentValue(colors, percent, accent)) {
  return { label: labelSegments(colors, label, value), bar: barSegments(colors, percent, accent) }
}

function usageCell(colors, label, kind, section, pick) {
  const percent = section && !section.error ? pick(section) : null
  return cell(colors, label, known(percent) ? usageColor(colors, kind, clamp(percent)) : colors.muted, percent)
}

function netCell(colors, net) {
  const ok = net && !net.error
  return cell(colors, "NET", colors.net, ok ? net.percent : null, rateValue(colors, ok ? net.rate : null))
}

// Linhas da grade: [CPU, RAM, DISK] e [GPU, VRAM, NET]; sem GPU a linha 2 tem só NET.
export function gridRows(colors, stats) {
  const rows = [
    [
      usageCell(colors, "CPU", "cpu", stats?.cpu, (s) => s.percent),
      usageCell(colors, "RAM", "ram", stats?.ram, (s) => s.percent),
      usageCell(colors, "DISK", "disk", stats?.disk, (s) => s.percent),
    ],
  ]
  const gpu = stats?.gpu
  const second = gpu
    ? [usageCell(colors, "GPU", "gpu", gpu, (s) => s.util), usageCell(colors, "VRAM", "vram", gpu, (s) => s.vramPercent)]
    : []
  rows.push([...second, netCell(colors, stats?.net)])
  return rows
}

export function titleText(stats) {
  const temp = stats?.gpu?.temp
  return known(temp) ? ` System · ${Math.round(temp)}° ` : " System "
}

// Cor do título: temperatura da GPU (neutra abaixo de 60 °C).
export const titleColor = (colors, stats) => {
  const temp = stats?.gpu?.temp
  return known(temp) ? tempColor(colors, temp) : colors.title
}

const flat = (segs) => segs.map((s) => s.t).join("")

// Grade em texto puro (sem borda), útil para testes.
export function gridText(rows) {
  return rows.flatMap((row) => [
    row.map((c) => flat(c.label)).join("  "),
    row.map((c) => flat(c.bar)).join("  "),
  ])
}

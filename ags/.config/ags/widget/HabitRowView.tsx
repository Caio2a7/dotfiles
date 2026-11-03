import { Gtk } from "ags/gtk4"
import { EstadoDia, addDias, estadoDia } from "./habitsCore"
import { HabitRow, HabitsState, registrar, somar } from "./habitsStore"

type Rgb = [number, number, number]
interface DrawCtx {
  setSourceRGBA(r: number, g: number, b: number, a: number): void
  rectangle(x: number, y: number, w: number, h: number): void
  arc(x: number, y: number, r: number, a1: number, a2: number): void
  fill(): void
}

const DEFAULT_RGB: Rgb = [0.6, 0.6, 0.65]
const SQ = 10
const GAP = 3
const DIAS = 7
const ROTULO: Partial<Record<EstadoDia, string>> = { parcial: "parcial", pulado: "pulado", falhou: "falhou" }

function rgbOf(cor: string | null): Rgb {
  if (!cor || !/^#[0-9a-fA-F]{6}$/.test(cor)) return DEFAULT_RGB
  const n = parseInt(cor.slice(1), 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function dot(rgb: Rgb): Gtk.Widget {
  const a = new Gtk.DrawingArea({ contentWidth: 8, contentHeight: 8, valign: Gtk.Align.CENTER })
  a.set_draw_func((_a, cr) => {
    const c = cr as unknown as DrawCtx
    c.setSourceRGBA(rgb[0], rgb[1], rgb[2], 0.95)
    c.arc(4, 4, 4, 0, 2 * Math.PI)
    c.fill()
  })
  return a
}

function alphaOf(e: EstadoDia): [number, boolean] {
  if (e === "feito") return [1, true]
  if (e === "parcial") return [0.5, true]
  if (e === "falhou") return [0.5, false]
  return [0.1, true]
}

// 7 quadradinhos (hoje na direita): cor do hábito = feito/parcial; vermelho = falhou; apagado = sem dado
function spark(s: HabitsState, row: HabitRow, estadoAt: (d: string) => EstadoDia): Gtk.Widget {
  const rgb = rgbOf(row.hab.cor)
  const estados = Array.from({ length: DIAS }, (_, i) => estadoAt(addDias(s.hoje, i - (DIAS - 1))))
  const a = new Gtk.DrawingArea({ contentWidth: DIAS * SQ + (DIAS - 1) * GAP, contentHeight: SQ, valign: Gtk.Align.CENTER })
  a.set_draw_func((_a, cr) => {
    const c = cr as unknown as DrawCtx
    estados.forEach((e, i) => {
      const [al, own] = alphaOf(e)
      const [r, g, b] = own ? rgb : [0.95, 0.45, 0.48]
      c.setSourceRGBA(r, g, b, al)
      c.rectangle(i * (SQ + GAP), 0, SQ, SQ)
      c.fill()
    })
  })
  return a
}

function btn(text: string, on: boolean, action: () => void, tip?: string): Gtk.Button {
  const b = new Gtk.Button({ label: text, cssClasses: on ? ["habit-btn", "on"] : ["habit-btn"] })
  if (tip) b.tooltipText = tip
  b.connect("clicked", action)
  return b
}

type Report = (fn: () => void) => void

function boolControls(row: HabitRow, report: Report): Gtk.Widget[] {
  const feito = row.dia.estado === "feito"
  const h = row.hab.key
  return [btn(feito ? "Feito" : "Marcar", feito, () => report(() => registrar(feito ? { h } : { h, s: "feito" })))]
}

function abstControls(row: HabitRow, report: Report): Gtk.Widget[] {
  const h = row.hab.key
  const st = row.dia.estado
  return [
    btn("Limpo", st === "feito", () => report(() => registrar(st === "feito" ? { h } : { h, s: "feito" }))),
    btn("Recaída", st === "falhou", () => report(() => registrar(st === "falhou" ? { h } : { h, s: "falhou" }))),
  ]
}

function numControls(s: HabitsState, row: HabitRow, report: Report): Gtk.Widget[] {
  const { hab, dia } = row
  const h = hab.key
  const entry = new Gtk.Entry({ widthChars: 4, maxWidthChars: 4, cssClasses: ["habit-entry"], placeholderText: "0" })
  entry.connect("activate", () => {
    const v = Number(entry.text.replace(",", "."))
    const prev = s.mapa.get(`${s.hoje}|${h}`)
    report(() => registrar({ h, s: prev?.s ?? null, v, n: prev?.n ?? null }))
    entry.text = ""
  })
  const val = `${Math.round(dia.v ?? 0)}${hab.meta ? `/${hab.meta}` : ""} ${hab.unidade ?? ""}`.trim()
  const lbl = new Gtk.Label({ label: dia.auto ? `${val} (auto)` : val, cssClasses: ["habit-value"] })
  return [lbl, btn("+5", false, () => report(() => somar({ h, v: 5 }))), btn("+15", false, () => report(() => somar({ h, v: 15 }))), entry]
}

function moreMenu(s: HabitsState, row: HabitRow, report: Report): Gtk.Widget {
  const { hab } = row
  const h = hab.key
  const prev = s.mapa.get(`${s.hoje}|${h}`)
  const keep = { v: prev?.v ?? null, n: prev?.n ?? null }
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  const pop = new Gtk.Popover({ child: box, hasArrow: false })
  const item = (text: string, fn: () => void) => {
    box.append(btn(text, false, () => { pop.popdown(); report(fn) }))
  }
  if (hab.tipo !== "abstinencia") {
    item("Pulado", () => registrar({ h, s: "pulado", ...keep }))
    item("Falhou", () => registrar({ h, s: "falhou", ...keep }))
  }
  item("Limpar", () => registrar({ h }))
  return new Gtk.MenuButton({ label: "...", popover: pop, cssClasses: ["habit-more"], tooltipText: "Pulado, Falhou, Limpar" })
}

function controlsOf(s: HabitsState, row: HabitRow, report: Report): Gtk.Widget[] {
  if (row.hab.tipo === "bool") return boolControls(row, report)
  if (row.hab.tipo === "abstinencia") return abstControls(row, report)
  return numControls(s, row, report)
}

const pct = (x: number | null): string => (x === null ? "-" : `${Math.round(x * 100)}%`)

function tooltipOf(row: HabitRow): string {
  const r = row.resumo
  const l = [`Score ${pct(r.score)}`, `30 dias ${pct(r.taxa30)}`, `Sequência ${r.seqAtual} (melhor ${r.melhorSeq})`]
  if (row.hab.minimo) l.push(`Mínimo: ${row.hab.minimo}`)
  if (r.limpos) l.push(`Limpos 30d: ${r.limpos.d30.n}/${r.limpos.d30.total}`)
  return l.join("\n")
}

function header(row: HabitRow): Gtk.Widget {
  const when = new Gtk.Label({ label: row.hab.quando ?? "", xalign: 0, cssClasses: ["habit-when"], ellipsize: 3 })
  const name = new Gtk.Label({ label: row.hab.nome, xalign: 0, cssClasses: ["habit-name"] })
  const rotulo = ROTULO[row.dia.estado]
  const col = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true, valign: Gtk.Align.CENTER })
  col.append(name)
  col.append(when)
  const top = new Gtk.Box({ spacing: 8 })
  top.append(dot(rgbOf(row.hab.cor)))
  top.append(col)
  if (rotulo) top.append(new Gtk.Label({ label: rotulo, cssClasses: ["habit-tag"] }))
  return top
}

export function buildHabitRow(s: HabitsState, row: HabitRow, report: Report): Gtk.Widget {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, cssClasses: ["habit-row"] })
  box.tooltipText = tooltipOf(row)
  const ctrl = new Gtk.Box({ spacing: 4, halign: Gtk.Align.END })
  controlsOf(s, row, report).forEach((w) => ctrl.append(w))
  ctrl.append(moreMenu(s, row, report))
  const top = header(row)
  ;(top as Gtk.Box).append(ctrl)
  const estadoAt = (d: string): EstadoDia => rowEstado(s, row, d)
  const bottom = new Gtk.Box({ spacing: 8 })
  bottom.append(spark(s, row, estadoAt))
  bottom.append(new Gtk.Label({ label: pct(row.resumo.score), cssClasses: ["habit-score"] }))
  box.append(top)
  box.append(bottom)
  return box
}

function rowEstado(s: HabitsState, row: HabitRow, d: string): EstadoDia {
  return estadoDia(row.hab, s.mapa, d, s.hoje).estado
}

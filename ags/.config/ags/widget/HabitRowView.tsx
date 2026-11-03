import { Gtk } from "ags/gtk4"
import { EstadoDia, addDias, estadoDia } from "./habitsCore"
import { HabitRow, HabitsState, registrar } from "./habitsStore"

type Rgb = [number, number, number]
interface DrawCtx {
  setSourceRGBA(r: number, g: number, b: number, a: number): void
  rectangle(x: number, y: number, w: number, h: number): void
  fill(): void
}

export interface HabitView {
  widget: Gtk.Widget
  update(s: HabitsState, row: HabitRow): void
}

const DEFAULT_RGB: Rgb = [0.6, 0.6, 0.65]
const HEX = /^#[0-9a-fA-F]{6}$/
const SQ = 10
const GAP = 3
const DIAS = 7
const ROTULO: Partial<Record<EstadoDia, string>> = { parcial: "parcial", pulado: "pulado", falhou: "falhou" }

function rgbOf(cor: string | null): Rgb {
  if (!cor || !HEX.test(cor)) return DEFAULT_RGB
  const n = parseInt(cor.slice(1), 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function alphaOf(e: EstadoDia): [number, boolean] {
  if (e === "feito") return [1, true]
  if (e === "parcial") return [0.5, true]
  if (e === "falhou") return [0.5, false]
  return [0.1, true]
}

// Cor do hábito aplicada só ao checkbox deste row (estado "on" com transição CSS)
function colorCheck(check: Gtk.Widget, cor: string | null): void {
  const hex = cor && HEX.test(cor) ? cor : "#94a3b8"
  const css = new Gtk.CssProvider()
  css.load_from_string(`.habit-check.on { background: ${hex}; border-color: ${hex}; }`)
  check.get_style_context().add_provider(css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
}

const pct = (x: number | null): string => (x === null ? "-" : `${Math.round(x * 100)}%`)

function tooltipOf(row: HabitRow): string {
  const r = row.resumo
  const l = [`Score ${pct(r.score)}`, `30 dias ${pct(r.taxa30)}`, `Sequência ${r.seqAtual} (melhor ${r.melhorSeq})`]
  if (r.limpos) l.push(`Limpos 30d: ${r.limpos.d30.n}/${r.limpos.d30.total}`)
  return l.join("\n")
}

function sparkArea(rgb: Rgb, getEstados: () => EstadoDia[]): Gtk.DrawingArea {
  const a = new Gtk.DrawingArea({ contentWidth: DIAS * SQ + (DIAS - 1) * GAP, contentHeight: SQ, valign: Gtk.Align.CENTER })
  a.set_draw_func((_a, cr) => {
    const c = cr as unknown as DrawCtx
    getEstados().forEach((e, i) => {
      const [al, own] = alphaOf(e)
      const [r, g, b] = own ? rgb : [0.95, 0.45, 0.48]
      c.setSourceRGBA(r, g, b, al)
      c.rectangle(i * (SQ + GAP), 0, SQ, SQ)
      c.fill()
    })
  })
  return a
}

function estadosOf(s: HabitsState, row: HabitRow): EstadoDia[] {
  return Array.from({ length: DIAS }, (_, i) => estadoDia(row.hab, s.mapa, addDias(s.hoje, i - (DIAS - 1)), s.hoje).estado)
}

// Linha inteira clicável: alterna pendente <-> feito (otimista; reverte se a escrita falhar)
export function buildHabitRow(s: HabitsState, row: HabitRow, onError: (e: unknown) => void): HabitView {
  const key = row.hab.key
  let on = false
  let estados = estadosOf(s, row)
  const check = new Gtk.Box({ cssClasses: ["habit-check"], valign: Gtk.Align.CENTER, halign: Gtk.Align.CENTER })
  colorCheck(check, row.hab.cor)
  const name = new Gtk.Label({ label: row.hab.nome, xalign: 0, hexpand: true, cssClasses: ["habit-name"] })
  const tag = new Gtk.Label({ cssClasses: ["habit-tag"] })
  const score = new Gtk.Label({ cssClasses: ["habit-score"] })
  const spark = sparkArea(rgbOf(row.hab.cor), () => estados)
  const box = new Gtk.Box({ spacing: 12, cssClasses: ["habit-row"] })
  ;[check, name, tag, spark, score].forEach((w) => box.append(w))
  box.set_cursor_from_name("pointer")

  const setOn = (v: boolean) => {
    on = v
    for (const w of [box, check]) {
      if (v) w.add_css_class("on")
      else w.remove_css_class("on")
    }
  }
  const update = (st: HabitsState, r: HabitRow) => {
    estados = estadosOf(st, r)
    setOn(r.dia.estado === "feito")
    tag.label = ROTULO[r.dia.estado] ?? ""
    score.label = pct(r.resumo.score)
    box.tooltipText = tooltipOf(r)
    spark.queue_draw()
  }
  const click = new Gtk.GestureClick()
  click.set_button(1)
  click.connect("pressed", () => {
    const was = on
    setOn(!was)
    try {
      registrar(was ? { h: key } : { h: key, s: "feito" })
    } catch (err) {
      setOn(was)
      onError(err)
    }
  })
  box.add_controller(click)
  update(s, row)
  return { widget: box, update }
}

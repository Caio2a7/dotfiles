import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import cairo from "gi://cairo"
import { StudyState, initials, subscribeStudy } from "./studyTracker"

type Active = Extract<StudyState, { active: true }>

// const RING_SIZE = 30
const RING_SIZE = 28
const RING_STROKE = 3
const TICK_SECONDS = 15
const GREEN = [0.188, 0.82, 0.345]

const sessionMin = (s: Active): number => Math.max(0, (Date.now() - s.inicioMs) / 60000)

// Fração do anel: (gasto + sessão) / estimado; sem estimativa, progresso da sessão dentro da hora
export function progressOf(s: Active): number {
  const sess = sessionMin(s)
  const frac = s.estimadoMin > 0 ? (s.gastoMin + sess) / s.estimadoMin : (sess % 60) / 60
  return Math.min(1, Math.max(0, frac))
}

// "42" abaixo de 1h; "1:12" a partir de 1h
export function sessionLabel(s: Active): string {
  const m = Math.floor(sessionMin(s))
  return m < 60 ? `${m}` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
}

const fmtDur = (min: number): string => {
  const t = Math.round(min)
  const h = Math.floor(t / 60)
  const m = t % 60
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`
}

function tooltipOf(s: Active): string {
  const week = fmtDur(s.gastoMin + sessionMin(s))
  const est = s.estimadoMin > 0 ? ` / ${fmtDur(s.estimadoMin)}` : ""
  return `${s.materia} · sessão ${fmtDur(sessionMin(s))} · semana ${week}${est}`
}

// Subconjunto do cairo.Context do GJS usado no anel (os typings não expõem os métodos)
interface RingContext {
  setLineWidth(w: number): void
  setLineCap(cap: cairo.LineCap): void
  setSourceRGBA(r: number, g: number, b: number, a: number): void
  arc(x: number, y: number, r: number, a1: number, a2: number): void
  stroke(): void
}

function drawRing(cr: RingContext, w: number, h: number, frac: number): void {
  const cx = w / 2
  const cy = h / 2
  const r = (Math.min(w, h) - RING_STROKE) / 2
  cr.setLineWidth(RING_STROKE)
  cr.setLineCap(cairo.LineCap.ROUND)
  cr.setSourceRGBA(1, 1, 1, 0.12)
  cr.arc(cx, cy, r, 0, 2 * Math.PI)
  cr.stroke()
  if (frac <= 0) return
  if (frac >= 1) cr.setSourceRGBA(1, 1, 1, 0.95)
  else cr.setSourceRGBA(GREEN[0], GREEN[1], GREEN[2], 1)
  const start = -Math.PI / 2
  cr.arc(cx, cy, r, start, start + 2 * Math.PI * frac)
  cr.stroke()
}

// Abre a nota no Obsidian via URI; erros são logados explicitamente
function openInObsidian(s: Active): void {
  const uri = `obsidian://open?vault=${encodeURIComponent(s.vault)}&file=${encodeURIComponent(s.relPath)}`
  Gio.AppInfo.launch_default_for_uri_async(uri, null, null, (_src, res) => {
    try {
      Gio.AppInfo.launch_default_for_uri_finish(res)
    } catch (err) {
      console.error("Falha ao abrir nota no Obsidian:", uri, err)
    }
  })
}

export function StudySection() {
  let state: StudyState = { active: false }
  let tickId = 0

  const ring = new Gtk.DrawingArea({ contentWidth: RING_SIZE, contentHeight: RING_SIZE, halign: Gtk.Align.CENTER })
  const timeLabel = new Gtk.Label({ cssClasses: ["study-time"], halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER })
  const overlay = new Gtk.Overlay({ child: ring, halign: Gtk.Align.CENTER })
  overlay.add_overlay(timeLabel)
  const subject = new Gtk.Label({ cssClasses: ["study-subject"], halign: Gtk.Align.CENTER })

  const box = new Gtk.Box({
    cssClasses: ["apple-status-capsule", "study-capsule"],
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    halign: Gtk.Align.CENTER,
    visible: false,
  })
  box.append(overlay)
  box.append(subject)
  box.set_cursor_from_name("pointer")

  ring.set_draw_func((_a, cr, w, h) => {
    if (state.active) drawRing(cr as unknown as RingContext, w, h, progressOf(state))
  })

  const refresh = () => {
    if (!state.active) return
    timeLabel.label = sessionLabel(state)
    box.tooltipText = tooltipOf(state)
    ring.queue_draw()
  }

  const stopTick = () => {
    if (tickId) GLib.source_remove(tickId)
    tickId = 0
  }

  const apply = (next: StudyState) => {
    state = next
    box.visible = next.active
    stopTick()
    if (!next.active) return
    subject.label = initials(next.materia)
    refresh()
    tickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, TICK_SECONDS, () => {
      refresh()
      return GLib.SOURCE_CONTINUE
    })
  }

  const click = new Gtk.GestureClick()
  click.set_button(1)
  click.connect("pressed", () => {
    if (state.active) openInObsidian(state)
  })
  box.add_controller(click)

  const unsubscribe = subscribeStudy(apply)
  box.connect("destroy", () => {
    stopTick()
    unsubscribe()
  })
  return box
}

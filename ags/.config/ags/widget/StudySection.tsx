import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import cairo from "gi://cairo"
import { initials, subscribeStudy } from "./studyTracker"
import type { StudyState } from "./studyTracker"

type Active = Extract<StudyState, { active: true }>

const RING_SIZE = 30
const RING_STROKE = 2.5
const REVEAL_MS = 180
const DEFAULT_RGB: [number, number, number] = [0.188, 0.82, 0.345]

const sessionSec = (s: Active, now = Date.now()): number => Math.max(0, (now - s.inicioMs) / 1000)

// Fração do anel: (gasto + sessão) / estimado; sem estimativa, ciclo de 60 min
export function progressOf(s: Active, now = Date.now()): number {
  const min = sessionSec(s, now) / 60
  const frac = s.estimadoMin > 0 ? (s.gastoMin + min) / s.estimadoMin : (min % 60) / 60
  return Math.min(1, Math.max(0, frac))
}

// m:ss abaixo de 1h; h:mm:ss a partir de 1h
export function clockLabel(totalSec: number): string {
  const t = Math.floor(totalSec)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, "0")
  return h === 0 ? `${m}:${sec}` : `${h}:${String(m).padStart(2, "0")}:${sec}`
}

const fmtDur = (min: number): string => {
  const t = Math.round(min)
  const h = Math.floor(t / 60)
  const m = t % 60
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`
}

function tooltipOf(s: Active): string {
  const sessMin = sessionSec(s) / 60
  const lines = [s.materia]
  if (s.blocoLabel || s.bloco) lines.push(`Bloco: ${s.blocoLabel ?? s.bloco}`)
  lines.push(`Sessão: ${fmtDur(sessMin)}`, `Semana: ${fmtDur(s.gastoMin + sessMin)}`)
  if (s.estimadoMin > 0) lines.push(`Meta: ${fmtDur(s.estimadoMin)}`)
  return lines.join("\n")
}

function rgbOf(cor?: string): [number, number, number] {
  if (!cor || !/^#[0-9a-fA-F]{6}$/.test(cor)) return DEFAULT_RGB
  const n = parseInt(cor.slice(1), 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// Subconjunto do cairo.Context do GJS usado no anel (os typings não expõem os métodos)
interface RingContext {
  setLineWidth(w: number): void
  setLineCap(cap: cairo.LineCap): void
  setSourceRGBA(r: number, g: number, b: number, a: number): void
  arc(x: number, y: number, r: number, a1: number, a2: number): void
  stroke(): void
}

function drawRing(cr: RingContext, w: number, h: number, frac: number, rgb: [number, number, number]): void {
  const cx = w / 2
  const cy = h / 2
  const r = (Math.min(w, h) - RING_STROKE) / 2
  cr.setLineWidth(RING_STROKE)
  cr.setLineCap(cairo.LineCap.ROUND)
  cr.setSourceRGBA(1, 1, 1, 0.1)
  cr.arc(cx, cy, r, 0, 2 * Math.PI)
  cr.stroke()
  if (frac <= 0) return
  cr.setSourceRGBA(rgb[0], rgb[1], rgb[2], frac >= 1 ? 1 : 0.95)
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

function buildChip() {
  const ring = new Gtk.DrawingArea({ contentWidth: RING_SIZE, contentHeight: RING_SIZE, halign: Gtk.Align.CENTER })
  const initialsLabel = new Gtk.Label({ cssClasses: ["study-subject"], halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER })
  const dot = new Gtk.Box({ cssClasses: ["study-rec-dot"], halign: Gtk.Align.END, valign: Gtk.Align.START })
  const overlay = new Gtk.Overlay({ child: ring, halign: Gtk.Align.CENTER })
  overlay.add_overlay(initialsLabel)
  overlay.add_overlay(dot)
  overlay.set_measure_overlay(initialsLabel, false)
  overlay.set_measure_overlay(dot, false)
  const clock = new Gtk.Label({ cssClasses: ["study-time"], halign: Gtk.Align.CENTER })
  const box = new Gtk.Box({
    cssClasses: ["apple-status-capsule", "study-capsule"],
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 3,
    halign: Gtk.Align.CENTER,
  })
  box.append(overlay)
  box.append(clock)
  box.set_cursor_from_name("pointer")
  return { box, ring, initialsLabel, clock }
}

export function StudySection() {
  let state: StudyState = { active: false }
  let shown: Active | null = null
  let tickId = 0

  const { box, ring, initialsLabel, clock } = buildChip()
  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: REVEAL_MS,
    revealChild: false,
    child: box,
  })

  ring.set_draw_func((_a, cr, w, h) => {
    if (shown) drawRing(cr as unknown as RingContext, w, h, progressOf(shown), rgbOf(shown.cor))
  })

  const refresh = () => {
    if (!shown) return
    clock.label = clockLabel(sessionSec(shown))
    box.tooltipText = tooltipOf(shown)
    ring.queue_draw()
  }

  const stopTick = () => {
    if (tickId) GLib.source_remove(tickId)
    tickId = 0
  }

  const apply = (next: StudyState) => {
    state = next
    stopTick()
    if (!next.active) {
      revealer.revealChild = false // mantém o último conteúdo durante a saída
      return
    }
    shown = next
    initialsLabel.label = initials(next.materia)
    refresh()
    revealer.revealChild = true
    tickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
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
  revealer.connect("destroy", () => {
    stopTick()
    unsubscribe()
  })
  return revealer
}

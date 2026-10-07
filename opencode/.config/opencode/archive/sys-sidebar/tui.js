import { createElement, insert, setProp } from "opentui:runtime-module:%40opentui%2Fsolid"
import { createSignal } from "opentui:runtime-module:solid-js"
import { collectAll } from "./stats.js"
import { CELL_WIDTH, gridRows, palette, titleColor, titleText } from "./bar.js"

const REFRESH_MS = 2000

function element(tag, props, children = []) {
  const node = createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) setProp(node, key, value)
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) insert(node, child)
  }
  return node
}
const text = (props, children = []) => element("text", props, children)
const box = (props, children = []) => element("box", props, children)
const bold = (props, children = []) => element("b", props, children)

const segNode = (s) => text({ fg: s.fg }, [s.bold ? bold({}, [s.t]) : s.t])
const line = (segs) => box({ flexDirection: "row", gap: 0 }, segs.map(segNode))
const cellBox = (c) => box({ gap: 0, width: CELL_WIDTH }, [line(c.label), line(c.bar)])
const rowBox = (row) => box({ flexDirection: "row", gap: 2 }, row.map(cellBox))

function buildPanel(theme, stats) {
  const colors = palette(theme)
  return box(
    {
      border: true,
      borderStyle: "rounded",
      borderColor: colors.border,
      title: titleText(stats),
      titleColor: titleColor(colors, stats),
      titleAlignment: "left",
      paddingX: 1,
      paddingY: 0,
      gap: 0,
    },
    gridRows(colors, stats).map(rowBox),
  )
}

export default {
  id: "sys-sidebar",
  async setup(context) {
    const [stats, setStats] = createSignal(undefined)
    let disposed = false
    let timer
    const load = async () => {
      try {
        const next = await collectAll()
        if (!disposed) setStats(next)
      } catch (err) {
        if (!disposed) setStats({
          cpu: null,
          ram: { error: String(err?.message ?? err) },
          disk: null,
          gpu: null,
          net: null,
        })
      } finally {
        if (!disposed) {
          timer = setTimeout(load, REFRESH_MS)
          context.renderer.requestRender()
        }
      }
    }
    await load()
    const unclaim = context.ui.slot({
      append: "sidebar.content",
      render: () => {
        const container = box({ gap: 0 })
        insert(container, () => buildPanel(context.theme, stats()))
        return container
      },
    })
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      unclaim()
    }
  },
}

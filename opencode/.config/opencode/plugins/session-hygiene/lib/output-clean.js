/**
 * Limpeza determinística de ruído não-semântico em saídas de shell.
 * Remove códigos ANSI (CSI/OSC), sobrescritas via \r, espaços à direita e
 * linhas em branco excessivas, preservando conteúdo útil e indentação.
 */

const ANSI_OSC_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
const ANSI_CSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g
const TRAILING_WS_RE = /[ \t]+$/gm
const EXCESS_NEWLINES_RE = /\n{3,}/g

function resolveCarriageReturns(line) {
  if (!line.includes("\r")) return line
  const parts = line.split("\r")
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].length > 0) return parts[i]
  }
  return ""
}

export function cleanShellText(text) {
  if (typeof text !== "string" || text.length === 0) return text

  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(ANSI_OSC_RE, "")
    .replace(ANSI_CSI_RE, "")

  if (cleaned.includes("\r")) {
    cleaned = cleaned.split("\n").map(resolveCarriageReturns).join("\n")
  }

  return cleaned
    .replace(TRAILING_WS_RE, "")
    .replace(EXCESS_NEWLINES_RE, "\n\n")
}

function cleanContent(content) {
  if (typeof content === "string") return cleanShellText(content)
  if (!Array.isArray(content)) return content

  let changed = false
  const next = content.map((item) => {
    if (item?.type !== "text" || typeof item.text !== "string") return item
    const cleaned = cleanShellText(item.text)
    if (cleaned === item.text) return item
    changed = true
    return { ...item, text: cleaned }
  })
  return changed ? next : content
}

export function cleanToolResult(result) {
  if (!result || typeof result !== "object") return result

  const nextContent = cleanContent(result.content)
  const nextOutput = typeof result.output === "string"
    ? cleanShellText(result.output)
    : result.output

  if (nextContent === result.content && nextOutput === result.output) {
    return result
  }

  const next = { ...result }
  if (nextContent !== result.content) next.content = nextContent
  if (nextOutput !== result.output) next.output = nextOutput
  return next
}

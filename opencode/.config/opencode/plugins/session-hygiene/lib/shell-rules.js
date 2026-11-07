import { parseShell, isFileWriteRedirect } from "./shell-parse.js"

export const WRITE_HINT = "Use a tool `edit` (alteração pontual) ou `write` (arquivo novo/inteiro) em vez de editar arquivos via shell."

const WRAPPERS = new Set(["sudo", "time", "env", "command", "nice", "nohup", "exec"])
const SHELLS = new Set(["bash", "sh", "zsh"])
const WRITER_CMDS = new Set(["cat", "echo", "printf"])
const PY_WRITE = /open\s*\([\s\S]{0,200}?,\s*['"][wax][bt+]*['"]|open\s*\([\s\S]{0,200}?mode\s*=\s*['"][wax]|\.write_(text|bytes)\s*\(/

const isFlag = (a) => a.startsWith("-") && a !== "-"
const hit = (kind, reason) => ({ kind, reason, hint: WRITE_HINT })

function isHarmlessTarget(target) {
  return /^\/dev\/(null|stderr|stdout|tty)$/.test(target) || target.endsWith(".log") || target.startsWith("&")
}

function splitCommand(words) {
  let idx = 0
  while (idx < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[idx]) || WRAPPERS.has(words[idx]))) idx++
  const cmd = (words[idx] ?? "").split("/").pop()
  return { cmd, args: words.slice(idx + 1) }
}

function redirectRule(seg, cmd) {
  const writer = !cmd || WRITER_CMDS.has(cmd) || seg.heredoc
  if (!writer) return null
  const bad = seg.redirects.find((r) => isFileWriteRedirect(r) && !isHarmlessTarget(r.target))
  return bad ? hit("write", `redirecionamento para arquivo (${bad.op} ${bad.target})`) : null
}

function teeRule(cmd, args) {
  if (cmd !== "tee") return null
  const bad = args.find((a) => !isFlag(a) && !isHarmlessTarget(a))
  return bad ? hit("write", `tee em arquivo (${bad})`) : null
}

function sedPerlRule(cmd, args) {
  const inPlace = cmd === "sed"
    ? args.some((a) => /^-i\S*$/.test(a) || /^-[A-Za-z]+i(\.[\w~]+)?$/.test(a) || a.startsWith("--in-place"))
    : cmd === "perl" && args.some((a) => /^-[A-Za-z]*i(\.[\w~]+)?$/.test(a))
  return inPlace ? hit("write", `${cmd} -i (edição in-place)`) : null
}

function pythonRule(seg, cmd, args) {
  if (!/^python[0-9.]*$/.test(cmd)) return null
  if (seg.heredoc) return hit("write", "python via heredoc (script inline)")
  const c = args.indexOf("-c")
  if (c !== -1 && PY_WRITE.test(args[c + 1] ?? "")) return hit("write", "python -c escrevendo arquivo")
  return null
}

function nestedRule(cmd, args, depth) {
  const c = args.indexOf("-c")
  if (!SHELLS.has(cmd) || c === -1 || !args[c + 1] || depth >= 3) return null
  return checkShellCommand(args[c + 1], depth + 1)
}

function checkSegment(seg, depth) {
  const { cmd, args } = splitCommand(seg.words)
  return redirectRule(seg, cmd) ?? teeRule(cmd, args) ?? sedPerlRule(cmd, args)
    ?? pythonRule(seg, cmd, args) ?? nestedRule(cmd, args, depth)
}

/** Retorna null se o comando é permitido, ou { kind, reason, hint } se deve ser bloqueado. */
export function checkShellCommand(command, depth = 0) {
  if (typeof command !== "string" || !command.trim()) return null
  for (const seg of parseShell(command)) {
    const found = checkSegment(seg, depth)
    if (found) return found
  }
  return null
}

export function blockedCommand(finding) {
  const text = `BLOQUEADO (session-hygiene): ${finding.reason}. ${finding.hint}`
  return `printf '%s\\n' '${text.replaceAll("'", "'\\''")}' >&2; exit 1`
}

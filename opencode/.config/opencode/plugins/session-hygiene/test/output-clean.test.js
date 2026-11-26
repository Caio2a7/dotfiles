import { test } from "node:test"
import assert from "node:assert/strict"
import { cleanShellText, cleanToolResult } from "../lib/output-clean.js"
import plugin from "../index.js"

function setupHooks() {
  const hooks = new Map()
  const fakeCtx = {
    tool: {
      async hook(name, fn) {
        hooks.set(name, fn)
      },
    },
  }
  return plugin.setup(fakeCtx).then(() => hooks)
}

test("cleanShellText retorna valores vazios ou não-string sem alterar", () => {
  assert.equal(cleanShellText(""), "")
  assert.equal(cleanShellText(null), null)
  assert.equal(cleanShellText(undefined), undefined)
  assert.equal(cleanShellText(42), 42)
})

test("cleanShellText remove ANSI CSI e OSC preservando texto", () => {
  const colored = "\x1b[1;32mPASS\x1b[0m \x1b[38;5;244msrc/app.js\x1b[0m\x1b[?25h"
  assert.equal(cleanShellText(colored), "PASS src/app.js")

  const oscBel = "\x1b]0;build\x07\x1b]8;;https://example.com\x07docs\x1b]8;;\x07"
  assert.equal(cleanShellText(oscBel), "docs")

  const oscSt = "\x1b]0;title\x1b\\ok"
  assert.equal(cleanShellText(oscSt), "ok")
})

test("cleanShellText resolve barras de progresso com \\r e normaliza CRLF", () => {
  assert.equal(cleanShellText("10%\r50%\r100%\n"), "100%\n")
  assert.equal(cleanShellText("10%\r50%\r"), "50%")
  assert.equal(cleanShellText("step 1\r\nstep 2\r\n"), "step 1\nstep 2\n")
  assert.equal(cleanShellText("\r\r\nnext"), "\nnext")
  assert.equal(cleanShellText("loading...\r\x1b[32mDone\x1b[0m\r\n"), "Done\n")
})

test("cleanShellText preserva indentação à esquerda e remove trailing whitespace", () => {
  const python = "def run():   \n    if True:\t \n        return 1  \n"
  assert.equal(cleanShellText(python), "def run():\n    if True:\n        return 1\n")

  const yaml = "services:\n  api:  \n    port: 8080\t\n"
  assert.equal(cleanShellText(yaml), "services:\n  api:\n    port: 8080\n")

  const diff = "+  const a = 1   \n-  const a = 0\t\n   context  \n"
  assert.equal(cleanShellText(diff), "+  const a = 1\n-  const a = 0\n   context\n")
})

test("cleanShellText colapsa 3+ quebras de linha preservando \\n\\n", () => {
  assert.equal(cleanShellText("a\n\n\n\nb"), "a\n\nb")
  assert.equal(cleanShellText("a\n\nb\nc"), "a\n\nb\nc")
  assert.equal(cleanShellText("a\n   \n\t\nb"), "a\n\nb")
})

test("cleanToolResult limpa content string, array misto e output", () => {
  const strRes = { content: "\x1b[31merr\x1b[0m  \n", metadata: { exitCode: 1 } }
  const cleanedStr = cleanToolResult(strRes)
  assert.deepEqual(cleanedStr, { content: "err\n", metadata: { exitCode: 1 } })
  assert.notEqual(cleanedStr, strRes)

  const filePart = { type: "file", path: "/tmp/a.png" }
  const arrRes = {
    content: [
      { type: "text", text: "10%\r100%\n" },
      filePart,
      { type: "text", text: "already clean" },
    ],
  }
  const cleanedArr = cleanToolResult(arrRes)
  assert.equal(cleanedArr.content[0].text, "100%\n")
  assert.equal(cleanedArr.content[1], filePart)
  assert.equal(cleanedArr.content[2], arrRes.content[2])

  const outRes = { output: "a\n\n\n\nb" }
  const cleanedOut = cleanToolResult(outRes)
  assert.deepEqual(cleanedOut, { output: "a\n\nb" })
  assert.equal("content" in cleanedOut, false)
})

test("cleanToolResult retorna mesma referência quando não há ruído ou inválido", () => {
  assert.equal(cleanToolResult(null), null)
  assert.equal(cleanToolResult(undefined), undefined)

  const cleanStr = { content: "ok\n\ndone", metadata: { exitCode: 0 } }
  assert.equal(cleanToolResult(cleanStr), cleanStr)

  const cleanArr = {
    content: [
      { type: "text", text: "  indented" },
      { type: "file", path: "/tmp/x" },
    ],
  }
  assert.equal(cleanToolResult(cleanArr), cleanArr)

  const cleanOut = { output: "line 1\nline 2" }
  assert.equal(cleanToolResult(cleanOut), cleanOut)
})

test("hook execute.after limpa shell/bash completed e ignora read ou error", async () => {
  const hooks = await setupHooks()
  const after = hooks.get("execute.after")
  assert.equal(typeof after, "function")

  const shellEvent = {
    tool: "shell",
    status: "completed",
    result: { content: "\x1b[32mok\x1b[0m   \n\n\n\ndone" },
  }
  await after(shellEvent)
  assert.equal(shellEvent.result.content, "ok\n\ndone")

  const bashEvent = {
    tool: "bash",
    status: "completed",
    result: { output: "10%\r90%\r100%\n" },
  }
  await after(bashEvent)
  assert.equal(bashEvent.result.output, "100%\n")

  const readResult = { content: "\x1b[31mraw\x1b[0m   \n\n\n\nkeep" }
  const readEvent = { tool: "read", status: "completed", result: readResult }
  await after(readEvent)
  assert.equal(readEvent.result, readResult)

  const errResult = { content: "\x1b[31mfail\x1b[0m   " }
  const errEvent = { tool: "shell", status: "error", result: errResult }
  await after(errEvent)
  assert.equal(errEvent.result, errResult)
})

test("hook execute.after é fail-open se result lançar exceção", async () => {
  const hooks = await setupHooks()
  const after = hooks.get("execute.after")

  const originalError = console.error
  const logged = []
  console.error = (...args) => logged.push(args.join(" "))
  try {
    const broken = {
      tool: "shell",
      status: "completed",
      get result() {
        throw new Error("boom")
      },
    }
    await assert.doesNotReject(() => after(broken))
    assert.equal(logged.length, 1)
    assert.match(logged[0], /\[session-hygiene\].*boom/)
  } finally {
    console.error = originalError
  }
})

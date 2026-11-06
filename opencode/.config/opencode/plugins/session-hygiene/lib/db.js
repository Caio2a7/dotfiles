import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)
const SESSION_ID = /^ses_[A-Za-z0-9]+$/
const DB_PATH = process.env.OPENCODE_DB ?? join(homedir(), ".local/share/opencode/opencode.db")

function assertSessionID(id) {
  if (!SESSION_ID.test(id)) throw new Error(`sessionID inválido: ${String(id).slice(0, 40)}`)
}

/** Consulta somente-leitura via CLI sqlite3 (sem dependências nativas). */
export async function query(sql) {
  const args = ["-readonly", "-json", "-cmd", ".timeout 3000", DB_PATH, sql]
  const { stdout } = await run("sqlite3", args, { timeout: 8000, maxBuffer: 4 * 1024 * 1024 })
  return stdout.trim() ? JSON.parse(stdout) : []
}

/** Estado de um filho para decidir descarte; null se a sessão não existe. */
export async function childStats(sessionID) {
  assertSessionID(sessionID)
  const [meta] = await query(
    `select (time_busy is not null and time_busy > coalesce(time_idle, 0)) as running,
            (select count(*) from session_message where session_id='${sessionID}' and type='assistant') as steps
       from session_v2 where id='${sessionID}'`,
  )
  if (!meta) return null
  const [ctx] = await query(
    `select coalesce(json_extract(data,'$.tokens.input'),0) + coalesce(json_extract(data,'$.tokens.cache.read'),0)
            + coalesce(json_extract(data,'$.tokens.cache.write'),0) as ctx
       from session_message where session_id='${sessionID}' and type='assistant'
        and coalesce(json_extract(data,'$.tokens.input'),0) + coalesce(json_extract(data,'$.tokens.cache.read'),0) > 0
      order by seq desc limit 1`,
  )
  const [text] = await query(
    `select json_extract(c.value,'$.text') as text from session_message m, json_each(m.data,'$.content') c
      where m.session_id='${sessionID}' and m.type='assistant' and json_extract(c.value,'$.type')='text'
      order by m.seq desc, c.key desc limit 1`,
  )
  return { running: meta.running === 1, assistantCount: meta.steps, lastContext: ctx?.ctx ?? 0, lastText: text?.text ?? "" }
}

async function contextAgeMs(directory) {
  try {
    return Date.now() - (await stat(join(directory, ".aiflow", "context.md"))).mtimeMs
  } catch (err) {
    if (err.code === "ENOENT") return null
    throw err
  }
}

/** Estatísticas de uma sessão raiz do orchestrator; null se não se aplica. */
export async function rootStats(sessionID) {
  assertSessionID(sessionID)
  const [row] = await query(
    `select agent, parent_id, directory, time_created,
            (select count(*) from session_message where session_id='${sessionID}' and type='user') as requests,
            (select count(*) from session_message where session_id='${sessionID}' and type='compaction') as compactions
       from session_v2 where id='${sessionID}'`,
  )
  if (!row || row.parent_id || row.agent !== "orchestrator") return null
  return {
    directory: row.directory,
    requests: row.requests,
    compactions: row.compactions,
    ageMs: Date.now() - row.time_created,
    contextAgeMs: await contextAgeMs(row.directory),
  }
}

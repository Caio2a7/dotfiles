import Gio from "gi://Gio"
import GLib from "gi://GLib"

export const GAMMA_MIN = 10
export const GAMMA_MAX = 100

const sockPath = () =>
  `${GLib.getenv("XDG_RUNTIME_DIR")}/hypr/${GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")}/.hyprsunset.sock`

function connect(): Promise<Gio.SocketConnection> {
  const client = new Gio.SocketClient()
  const addr = Gio.UnixSocketAddress.new(sockPath())
  return new Promise((resolve, reject) => {
    client.connect_async(addr, null, (_c, res) => {
      try {
        resolve(client.connect_finish(res))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function writeAll(conn: Gio.SocketConnection, msg: string): Promise<void> {
  const out = conn.get_output_stream()
  return new Promise((resolve, reject) => {
    out.write_all_async(new TextEncoder().encode(msg), GLib.PRIORITY_DEFAULT, null, (_s, res) => {
      try {
        out.write_all_finish(res)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
}

function readReply(conn: Gio.SocketConnection): Promise<string> {
  const inp = conn.get_input_stream()
  return new Promise((resolve, reject) => {
    inp.read_bytes_async(64, GLib.PRIORITY_DEFAULT, null, (_s, res) => {
      try {
        const bytes = inp.read_bytes_finish(res)
        resolve(new TextDecoder().decode(bytes.toArray()))
      } catch (e) {
        reject(e)
      }
    })
  })
}

/** Protocolo do hyprsunset: envia "gamma N" (ou "gamma" p/ ler) e recebe "ok" / valor. */
async function request(msg: string): Promise<string> {
  const conn = await connect()
  try {
    await writeAll(conn, msg)
    return await readReply(conn)
  } finally {
    conn.close(null)
  }
}

const clampGamma = (v: number) => Math.max(GAMMA_MIN, Math.min(GAMMA_MAX, Math.round(v)))

export async function queryGamma(): Promise<number | null> {
  try {
    const val = parseFloat((await request("gamma")).trim())
    return isNaN(val) ? null : clampGamma(val)
  } catch {
    return null
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) =>
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve()
      return GLib.SOURCE_REMOVE
    }),
  )

/** Garante hyprsunset ativo com socket respondendo; retorna o gamma atual ou null. */
export async function ensureSunset(tries = 30): Promise<number | null> {
  let started = false
  for (let i = 0; i < tries; i++) {
    const gamma = await queryGamma()
    if (gamma !== null) return gamma
    if (!started) {
      started = true
      GLib.spawn_command_line_async("hyprctl dispatch exec 'hyprsunset -i'")
    }
    await sleep(100)
  }
  console.error("hyprsunset não ficou pronto a tempo")
  return null
}

/** Envio assíncrono, 1 em voo, "latest value wins"; recupera o daemon se o envio falhar. */
export function createGammaSender() {
  let pending: number | null = null
  let inFlight = false

  const pump = async () => {
    if (inFlight) return
    inFlight = true
    while (pending !== null) {
      const val = pending
      pending = null
      try {
        await request(`gamma ${val}`)
      } catch (e) {
        console.error("hyprsunset gamma falhou, recuperando:", e)
        if ((await ensureSunset()) !== null) pending ??= val
      }
    }
    inFlight = false
  }

  return (val: number) => {
    pending = clampGamma(val)
    void pump()
  }
}

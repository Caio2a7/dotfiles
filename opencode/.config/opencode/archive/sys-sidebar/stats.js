import { readFile, statfs } from "node:fs/promises"
import { spawn } from "node:child_process"

const SMI_ARGS = [
  "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,name",
  "--format=csv,noheader,nounits",
]
const SMI_TIMEOUT_MS = 3000
const GIB = 1024 * 1024

let prevCpu = null

function readCpuTimes(text) {
  const line = text.split("\n").find((l) => l.startsWith("cpu "))
  if (!line) throw new Error("linha cpu ausente em /proc/stat")
  const v = line.trim().split(/\s+/).slice(1).map(Number)
  const idle = (v[3] ?? 0) + (v[4] ?? 0)
  const total = v.reduce((a, b) => a + b, 0)
  return { idle, total }
}

export async function collectCpu() {
  const cur = readCpuTimes(await readFile("/proc/stat", "utf8"))
  const prev = prevCpu
  prevCpu = cur
  if (!prev) return null
  const dTotal = cur.total - prev.total
  if (dTotal <= 0) return null
  return { percent: (1 - (cur.idle - prev.idle) / dTotal) * 100 }
}

function meminfoKb(text, key) {
  const m = new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(text)
  if (!m) throw new Error(`${key} ausente em /proc/meminfo`)
  return Number(m[1])
}

export async function collectRam() {
  const text = await readFile("/proc/meminfo", "utf8")
  const total = meminfoKb(text, "MemTotal")
  const used = total - meminfoKb(text, "MemAvailable")
  return { percent: (used / total) * 100, usedGiB: used / GIB, totalGiB: total / GIB }
}

function runNvidiaSmi() {
  return new Promise((resolve, reject) => {
    const child = spawn("nvidia-smi", SMI_ARGS, { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error("nvidia-smi timeout"))
    }, SMI_TIMEOUT_MS)
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || `nvidia-smi saiu com código ${code}`))
    })
  })
}

function parseGpu(stdout) {
  const f = stdout.trim().split("\n")[0]?.split(",").map((s) => s.trim())
  if (!f || f.length < 5) throw new Error("saída inesperada do nvidia-smi")
  const [util, used, total, temp] = f.slice(0, 4).map(Number)
  if ([util, used, total, temp].some((n) => !Number.isFinite(n))) {
    throw new Error("valores inválidos do nvidia-smi")
  }
  return {
    name: f.slice(4).join(","),
    util,
    temp,
    vramPercent: total > 0 ? (used / total) * 100 : 0,
    vramUsedGiB: used / 1024,
    vramTotalGiB: total / 1024,
  }
}

export async function collectGpu() {
  try {
    return parseGpu(await runNvidiaSmi())
  } catch (err) {
    if (err?.code === "ENOENT") return null
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function collectDisk() {
  const s = await statfs("/")
  const used = s.blocks - s.bfree
  const denom = used + s.bavail
  if (denom <= 0) throw new Error("statfs / retornou 0 blocos")
  return { percent: (used / denom) * 100 }
}

const NET_SKIP = ["lo", "docker", "veth", "br-", "virbr", "tun", "tap", "wg"]
const NET_WINDOW = 30
const NET_FLOOR = 1_048_576

let prevNet = null
const netRates = []

const isRealIface = (name) => !NET_SKIP.some((p) => (p === "lo" ? name === p : name.startsWith(p)))

function sumRxBytes(text) {
  let total = 0
  for (const l of text.split("\n").slice(2)) {
    const [name, rest] = l.split(":")
    if (!rest || !isRealIface(name.trim())) continue
    const rx = Number(rest.trim().split(/\s+/)[0])
    if (!Number.isFinite(rx)) throw new Error(`rx_bytes inválido em ${name.trim()}`)
    total += rx
  }
  return total
}

function netRate(bytes, now) {
  const prev = prevNet
  prevNet = { bytes, now }
  if (!prev || bytes < prev.bytes || now <= prev.now) return null
  return ((bytes - prev.bytes) / (now - prev.now)) * 1000
}

export async function collectNet() {
  const bytes = sumRxBytes(await readFile("/proc/net/dev", "utf8"))
  const rate = netRate(bytes, performance.now())
  if (rate === null) return null
  netRates.push(rate)
  if (netRates.length > NET_WINDOW) netRates.shift()
  const peak = Math.max(NET_FLOOR, ...netRates)
  return { rate, percent: (rate / peak) * 100 }
}

const errorOf = (r) => ({ error: String(r.reason?.message ?? r.reason) })

export async function collectAll() {
  const [cpu, ram, disk, gpu, net] = await Promise.allSettled([
    collectCpu(),
    collectRam(),
    collectDisk(),
    collectGpu(),
    collectNet(),
  ])
  return {
    cpu: cpu.status === "fulfilled" ? cpu.value : null,
    ram: ram.status === "fulfilled" ? ram.value : errorOf(ram),
    disk: disk.status === "fulfilled" ? disk.value : errorOf(disk),
    gpu: gpu.status === "fulfilled" ? gpu.value : errorOf(gpu),
    net: net.status === "fulfilled" ? net.value : errorOf(net),
  }
}

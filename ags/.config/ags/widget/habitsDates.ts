// Datas locais: aritmética UTC pura sobre strings YYYY-MM-DD (sem shift de fuso)
const DIA_MS = 86400000
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n: number, w = 2): string => String(n).padStart(w, "0")
const fmtUTC = (x: Date): string => `${pad(x.getUTCFullYear(), 4)}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`
const toUTC = (s: string): number => {
  const m = RE_DATA.exec(s)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN
}

export const dataValida = (s: unknown): s is string =>
  typeof s === "string" && RE_DATA.test(s) && fmtUTC(new Date(toUTC(s))) === s
export const addDias = (d: string, n: number): string => fmtUTC(new Date(toUTC(d) + n * DIA_MS))
export const diasEntre = (a: string, b: string): number => Math.round((toUTC(b) - toUTC(a)) / DIA_MS)
export const hojeISO = (now: Date = new Date()): string =>
  `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
export const segundaDe = (d: string): string => addDias(d, -((new Date(toUTC(d)).getUTCDay() + 6) % 7))


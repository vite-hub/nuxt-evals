export const percent = (value: number) => `${Math.round(value * 100)}%`

export const seconds = (ms: number) => `${Math.round(ms / 1000)} s`

/** 166635 → "167k", 28721000 → "28.7M" */
export const tokens = (value?: number) => value === undefined ? "–" : value >= 1e6 ? `${(value / 1e6).toFixed(1).replace(/\.0$/, "")}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)

export const day = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })

/** USD with enough digits for cheap runs: 0.0042 → "$0.0042", 1.234 → "$1.23". */
export const money = (usd: number) => !Number.isFinite(usd) ? "–" : usd >= 1 ? `$${usd.toFixed(2)}` : usd >= 0.01 ? `$${usd.toFixed(3).replace(/0$/, "")}` : `$${Number(usd.toPrecision(2))}`

/** 1.7 minutes reads better than 102 s on a log axis. */
export const duration = (ms: number) => ms >= 120_000 ? `${(ms / 60_000).toFixed(1).replace(/\.0$/, "")}m` : `${Math.round(ms / 1000)}s`

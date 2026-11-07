export const percent = (value: number) => `${Math.round(value * 100)}%`

export const seconds = (ms: number) => `${Math.round(ms / 1000)} s`

/** 166635 → "167k" */
export const tokens = (value?: number) => value === undefined ? "–" : value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)

export const day = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })

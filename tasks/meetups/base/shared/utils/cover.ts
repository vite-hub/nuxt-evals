export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const COVER_MAX_MB = 4
export const COVER_MAX_BYTES = COVER_MAX_MB * 1024 * 1024

export function coverUrl(path: string, width: number): string {
  return `/images/${path}?w=${width}`
}

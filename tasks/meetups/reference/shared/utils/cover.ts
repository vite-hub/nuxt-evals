/** Cover photos: what the upload form accepts and the server enforces. SVG stays out: it can carry script. */
export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const COVER_MAX_MB = 4
export const COVER_MAX_BYTES = COVER_MAX_MB * 1024 * 1024

/** The served address of a cover at the width the slot needs. /images is ViteHub Blob's serve route. */
export function coverUrl(path: string, width: number): string {
  return `/images/${path}?w=${width}`
}

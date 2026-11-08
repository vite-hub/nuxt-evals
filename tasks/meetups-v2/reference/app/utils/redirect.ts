/** `?redirect=` after sign-in, only when it is a path on this site. "//evil.example" and "/\evil.example" fall back to "/". */
export function safeRedirect(target: unknown): string {
  return typeof target === "string" && /^\/(?![/\\])/.test(target) ? target : "/"
}

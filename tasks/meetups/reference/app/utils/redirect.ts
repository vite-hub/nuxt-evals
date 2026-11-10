/**
 * `?redirect=` after sign-in, only when it is a plain path on this site. "//evil.example", "/\evil.example" and
 * paths with whitespace or control characters ("/%09/evil.example" decodes to a tab) fall back to "/".
 */
export function safeRedirect(target: unknown): string {
  return typeof target === "string" && /^\/(?![/\\])[^\s\u0000-\u001F\u007F]*$/.test(target) ? target : "/"
}

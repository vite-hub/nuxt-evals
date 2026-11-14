export function safeRedirect(target: unknown): string {
  return typeof target === "string" && /^\/(?![/\\])[^\s\u0000-\u001F\u007F]*$/.test(target) ? target : "/"
}

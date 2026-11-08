/** The server's message for a failed $fetch, or a generic one. */
export function errorMessage(error: unknown): string {
  const data = (error as { data?: { statusText?: string, message?: string } } | null)?.data
  return data?.statusText ?? data?.message ?? "Something went wrong. Try again."
}

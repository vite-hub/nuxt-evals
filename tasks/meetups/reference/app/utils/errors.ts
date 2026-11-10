/** The server's message for a failed $fetch: the first field issue of a 400, else its status text, else a generic one. */
export function errorMessage(error: unknown): string {
  const data = (error as { data?: { statusText?: string, message?: string, data?: { issues?: { message: string }[] } } } | null)?.data
  return data?.data?.issues?.[0]?.message ?? data?.statusText ?? data?.message ?? "Something went wrong. Try again."
}

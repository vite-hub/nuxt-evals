/**
 * Hands saved agent events to the relay Agent in the same request, and returns the run id the journal used.
 * The runner executes Codex on a Node host; the site's Agent re-emits its events so the session lives in this app's
 * journal and Console. Later the same Agent takes a live stream instead of saved events.
 */
const pending = new Map<string, unknown[]>()
const finished = new Map<string, string>()

export function openRelay(id: string, events: unknown[]): void {
  pending.set(id, events)
}

export async function* takeRelay(id: string): AsyncGenerator<unknown> {
  const events = pending.get(id)
  pending.delete(id)
  if (!events) throw new Error(`No relayed events for ${id}.`)
  for (const event of events) yield event
}

export function finishRelay(id: string, runId: string | undefined): void {
  if (runId) finished.set(id, runId)
}

export function relayRunId(id: string): string | undefined {
  const runId = finished.get(id)
  finished.delete(id)
  return runId
}

/** The journal record id: SHA-256 of [agent name, run id], the same as @vite-hub/agent computes it. */
export async function invocationRecordId(agent: string, runId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([agent, runId])))
  return `sha256_${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`
}

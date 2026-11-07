/**
 * The Driver of an Agent that only has imported sessions. ViteHub has no "external Agent" yet, so the Agent exists
 * for the Console and its journal, and running it here fails with a clear message.
 */
export function externalAgentDriver(name: string) {
  return {
    run: () => {
      throw new Error(`${name} runs outside this app, through the nuxt-evals CLI. Its sessions are imported with importAgentSession().`)
    },
  }
}

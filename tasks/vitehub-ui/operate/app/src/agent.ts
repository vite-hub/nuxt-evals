// The page bridge, created before the app mounts so it hears every component. `allow` approves each step and
// records it, so the grader can tell which changes came through the bridge.
import { agentTools, createAgent } from "@ui-sdk/core/agent"

const steps: unknown[] = []
const agent = createAgent({
  allow: (step) => {
    steps.push(step)
    return true
  },
})

Object.assign(window, { uiAgent: agent, uiAgentTools: agentTools, uiAgentSteps: steps })

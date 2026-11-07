<script setup lang="ts">
import { computed, ref } from "vue"
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@vite-hub/ui/trace"
import { CodeBlock, CodeBlockContent } from "@vite-hub/ui/code-block"
import type { SessionStepView, SessionView } from "#shared/report"


const props = defineProps<{ session: SessionView }>()

const icons: Record<SessionStepView["kind"], string> = {
  message: "i-lucide-message-square",
  final: "i-lucide-flag",
  thinking: "i-lucide-brain",
  command: "i-lucide-terminal",
  edit: "i-lucide-file-pen-line",
  plan: "i-lucide-list-checks",
  mcp: "i-lucide-plug",
  web: "i-lucide-globe",
  tool: "i-lucide-wrench",
}

const labels: Record<SessionStepView["kind"], string> = {
  message: "Message",
  final: "Final answer",
  thinking: "Thinking",
  command: "Command",
  edit: "Edit",
  plan: "Plan",
  mcp: "MCP",
  web: "Web",
  tool: "Tool",
}

const filters = [
  { id: "all", label: "All" },
  { id: "messages", label: "Messages", kinds: ["message", "final"] },
  { id: "commands", label: "Commands", kinds: ["command"] },
  { id: "edits", label: "Edits", kinds: ["edit"] },
  { id: "tools", label: "Skills, MCP, web", kinds: ["mcp", "web", "tool", "plan"] },
] as const
const filter = ref<(typeof filters)[number]["id"]>("all")
const showThinking = ref(false)

const counts = computed(() => Object.fromEntries(filters.map(item => [item.id, "kinds" in item ? props.session.steps.filter(step => (item.kinds as readonly string[]).includes(step.kind)).length : props.session.steps.length])))
const steps = computed(() => {
  const active = filters.find(item => item.id === filter.value)!
  return props.session.steps.filter(step => "kinds" in active
    ? (active.kinds as readonly string[]).includes(step.kind)
    : showThinking.value || step.kind !== "thinking")
})

function description(step: SessionStepView): string {
  return [labels[step.kind], step.failed ? "failed" : undefined, step.durationMs ? (step.durationMs < 1000 ? `${step.durationMs} ms` : `${(step.durationMs / 1000).toFixed(step.durationMs < 10_000 ? 1 : 0)} s`) : undefined].filter(Boolean).join(" · ")
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default px-4 py-2 text-xs">
      <button
        v-for="item in filters"
        :key="item.id"
        type="button"
        class="seg"
        :aria-pressed="filter === item.id"
        @click="filter = item.id"
      >
        {{ item.label }} <span class="tabular-nums text-dimmed">{{ counts[item.id] }}</span>
      </button>
      <label
        v-if="filter === 'all'"
        class="ml-auto flex cursor-pointer items-center gap-1.5 text-muted"
      >
        <input
          v-model="showThinking"
          type="checkbox"
          class="accent-(--ui-text-highlighted)"
        >
        Thinking
      </label>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <details
        v-if="session.prompt && filter === 'all'"
        class="mx-2 mb-3 rounded-sm border border-default px-3 py-2 text-sm"
      >
        <summary class="cursor-pointer text-muted">
          Prompt
        </summary>
        <pre class="mt-2 whitespace-pre-wrap font-sans text-[13px] text-default">{{ session.prompt }}</pre>
      </details>
      <Trace>
        <TraceCollapsible
          v-for="step in steps"
          :key="step.id"
          :data-kind="step.kind"
        >
          <TraceCollapsibleTrigger>
            <TraceLine :status="step.failed ? 'error' : undefined">
              <TraceIcon><UIcon :name="icons[step.kind]" /></TraceIcon>
              <TraceTitle>
                <span :class="step.kind === 'command' || step.kind === 'edit' ? 'font-mono text-[12px]' : ''">{{ step.title || labels[step.kind] }}</span>
              </TraceTitle>
              <TraceDescription>{{ description(step) }}</TraceDescription>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent v-if="step.body">
            <p
              v-if="step.kind === 'message' || step.kind === 'final' || step.kind === 'thinking'"
              class="whitespace-pre-wrap px-2 pb-2 text-[13px] leading-relaxed text-default"
            >
              {{ step.body }}
            </p>
            <CodeBlock
              v-else
              size="sm"
            >
              <CodeBlockContent :wrap="true">
                {{ step.body }}
              </CodeBlockContent>
            </CodeBlock>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
      <p
        v-if="!steps.length"
        class="px-4 py-6 text-sm text-muted"
      >
        No steps of this kind.
      </p>
    </div>
  </div>
</template>

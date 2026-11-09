<script setup lang="ts">
import { computed } from "vue"
import {
  AgentSession,
  AgentSessionDetailsRow,
  AgentSessionDetailsSection,
  AgentSessionTimeline,
  type AgentSessionSurface,
} from "@vite-hub/ui/agent-session"
import type { ProjectView, RunSummary, SessionView, WorkspaceView } from "#shared/report"
import { harnessLabel, modelLabel, projectLabel } from "#shared/labels"
import { day, money, percent } from "../utils/format"
import { sessionItems } from "../utils/agent-session"
import { fiveScale } from "../utils/rubric"

const props = defineProps<{
  run: RunSummary
  summary: string | null
  session?: SessionView | null
  sessionStatus: string
  workspace?: WorkspaceView | null
  workspaceStatus: string
  /** The run's project, for the rubric and the reference app's grade. */
  project?: ProjectView | null
}>()

const surfaces: AgentSessionSurface[] = [
  ...(props.run.rubric ? [{ id: "rubric", label: "Rubric", icon: "i-lucide-clipboard-check", shortcut: "r" }] : []),
  { id: "files", label: "Files", icon: "i-lucide-files", shortcut: "f" },
  { id: "preview", label: "Preview", icon: "i-lucide-app-window", shortcut: "v" },
  ...(props.run.probes.length ? [{ id: "probes", label: "Probes", icon: "i-lucide-list-checks", shortcut: "p" }] : []),
  { id: "summary", label: "Summary", icon: "i-lucide-file-text", shortcut: "s" },
]

const items = computed(() => props.session ? sessionItems(props.session) : [])
const passed = computed(() => props.run.probes.filter(probe => probe.passed).length)
const layers = computed(() => (["gate", "runtime", "static", "judge"] as const)
  .map(layer => ({ layer, probes: props.run.probes.filter(probe => probe.layer === layer) }))
  .filter(group => group.probes.length))
const layerTitles = { gate: "Gate", runtime: "Runtime", static: "Static", judge: "Judge" }
const tokens = (value?: number) => value === undefined ? "–" : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
const minutes = (ms: number) => `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
const audit = computed(() => props.run.diagnostics.audit)
const title = computed(() => `${projectLabel(props.run.project)} · ${harnessLabel(props.run.harness)} ${props.run.setup}${props.run.repeat}`)
</script>

<template>
  <AgentSession
    :title="title"
    :subtitle="`${modelLabel(run.model)} · ${run.reasoning}`"
    :surfaces="surfaces"
    :storage-key="run.rubric ? 'nuxt-evals:rubric-run-layout' : 'nuxt-evals:run-layout'"
    :default-surface="run.rubric ? 'rubric' : 'files'"
    :default-panel-open="true"
    :default-width="640"
  >
    <template #heading>
      <NuxtLink
        to="/"
        class="text-sm text-dimmed transition-colors hover:text-highlighted"
        aria-label="Back to the results"
      >
        Results
      </NuxtLink>
      <span
        class="text-dimmed"
        aria-hidden="true"
      >/</span>
      <h1 class="vh-agent-session__title">
        {{ title }}
      </h1>
      <span class="vh-agent-session__subtitle">{{ modelLabel(run.model) }} · {{ run.reasoning }}</span>
    </template>

    <AgentSessionTimeline
      v-if="session"
      :items="items"
    />
    <p
      v-else
      class="px-1 py-6 text-sm text-muted"
    >
      {{ sessionStatus === "error" ? "This run has no session file." : "Loading the session…" }}
    </p>

    <template #details>
      <AgentSessionDetailsSection title="Result">
        <AgentSessionDetailsRow
          v-if="run.rubric"
          icon="i-lucide-clipboard-check"
          label="Rubric"
          :value="`${fiveScale(run.rubric.score)} of 5`"
        />
        <AgentSessionDetailsRow
          v-if="run.rubric && project?.reference"
          icon="i-lucide-medal"
          label="Reference"
          :value="`${fiveScale(project.reference.score)} of 5`"
          tone="muted"
        />
        <AgentSessionDetailsRow
          v-if="run.probes.length"
          icon="i-lucide-circle-check"
          label="Probes"
          :value="`${passed}/${run.probes.length}`"
          :tone="passed === run.probes.length ? 'success' : 'default'"
        />
        <AgentSessionDetailsRow
          v-if="!run.rubric"
          icon="i-lucide-percent"
          label="Score"
          :value="percent(run.score)"
        />
        <AgentSessionDetailsRow
          v-if="audit"
          icon="i-lucide-shield-check"
          label="Audit"
          :value="audit.passed ? 'Clean' : audit.problems.length === 1 ? '1 problem' : `${audit.problems.length} problems`"
          :tone="audit.passed ? 'default' : 'error'"
          :title="audit.problems.join('\n') || undefined"
        />
        <AgentSessionDetailsRow
          v-if="workspace"
          icon="i-lucide-file-diff"
          label="Changed files"
          :value="workspace.changes.length"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection title="Agent">
        <AgentSessionDetailsRow
          icon="i-lucide-bot"
          :label="harnessLabel(run.harness)"
          :value="`Setup ${run.setup}`"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-cpu"
          :label="modelLabel(run.model)"
          :value="run.reasoning"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-plug"
          label="Nuxt MCP"
          :value="run.diagnostics.mcpCalls === 1 ? '1 call' : `${run.diagnostics.mcpCalls} calls`"
          tone="muted"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-sparkles"
          label="Skill reads"
          :value="run.diagnostics.skillReads"
          tone="muted"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-globe"
          label="Web fetches"
          :value="run.diagnostics.webFetches"
          tone="muted"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection title="Usage">
        <AgentSessionDetailsRow
          icon="i-lucide-coins"
          label="Estimated cost"
          :value="money(Number(run.usage.costUsd ?? 0))"
          :title="run.usage.costSource ? `List prices from ${run.usage.costSource}` : undefined"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-timer"
          label="Duration"
          :value="minutes(run.durationMs)"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-arrow-down-to-line"
          label="Input"
          :value="tokens(run.usage.inputTokens)"
        />
        <AgentSessionDetailsRow
          v-if="run.usage.cachedInputTokens"
          icon="i-lucide-database"
          label="Cached input"
          :value="tokens(run.usage.cachedInputTokens)"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-arrow-up-from-line"
          label="Output"
          :value="tokens(run.usage.outputTokens)"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection>
        <AgentSessionDetailsRow
          icon="i-lucide-calendar"
          label="Started"
          :value="`${day(run.startedAt)} UTC`"
          tone="muted"
        />
      </AgentSessionDetailsSection>
    </template>

    <template #surface-files>
      <div class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="workspace"
          class="flex h-8 shrink-0 items-center gap-2 border-y border-default px-3 font-mono text-xs text-muted"
        >
          {{ workspace.ref }} · {{ workspace.revision.slice(0, 8) }}
        </div>
        <RunWorkspace
          v-if="workspace"
          :run-id="run.id"
          :workspace="workspace"
        />
        <p
          v-else
          class="px-4 py-6 text-sm text-muted"
        >
          {{ workspaceStatus === "error" ? "This run has no files in the Workspace." : "Loading the files…" }}
        </p>
      </div>
    </template>

    <template #surface-preview>
      <AppPreview
        :source="`/api/runs/${run.id}/files`"
        :label="title"
      />
    </template>

    <template #surface-rubric>
      <RubricGradeView
        v-if="run.rubric"
        :grade="run.rubric"
        :rubric="project?.rubric"
        :compare="project?.reference"
        compare-label="Reference app"
      />
    </template>

    <template #surface-probes>
      <div class="min-h-0 flex-1 overflow-y-auto border-t border-default px-3 py-3">
        <section
          v-for="group in layers"
          :key="group.layer"
          class="mb-4"
        >
          <h3 class="mb-1 flex h-8 items-center px-2.5 text-[11px] font-medium text-muted">
            {{ layerTitles[group.layer] }}
            <span class="ml-auto tabular-nums text-dimmed">{{ group.probes.filter(probe => probe.passed).length }}/{{ group.probes.length }}</span>
          </h3>
          <ul>
            <li
              v-for="probe in group.probes"
              :key="probe.id"
              class="flex gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-elevated/60"
            >
              <UIcon
                :name="probe.passed ? 'i-lucide-check' : 'i-lucide-x'"
                class="mt-0.5 size-4 shrink-0"
                :class="probe.passed ? 'text-muted' : 'text-error'"
              />
              <span class="min-w-0 flex-1">
                <InlineCode
                  :class="probe.passed ? 'text-default' : 'text-highlighted'"
                  :text="probe.title"
                />
                <span
                  v-if="probe.detail"
                  class="block font-mono text-xs text-dimmed"
                >{{ probe.detail }}</span>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <template #surface-summary>
      <div class="min-h-0 flex-1 overflow-y-auto border-t border-default px-6 py-5">
        <RunSummary
          v-if="summary"
          :markdown="summary"
        />
        <p
          v-else
          class="text-sm text-muted"
        >
          This run has no summary yet.
        </p>
      </div>
    </template>
  </AgentSession>
</template>

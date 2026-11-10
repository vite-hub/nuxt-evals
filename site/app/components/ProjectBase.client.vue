<script setup lang="ts">
import { computed, ref, watch } from "vue"
import {
  AgentSession,
  AgentSessionDetailsRow,
  AgentSessionDetailsSection,
  AgentSessionTimeline,
  type AgentSessionItem,
  type AgentSessionSurface,
} from "@vite-hub/ui/agent-session"
import type { ProjectProbe, ProjectView, RunSummary } from "#shared/report"
import { projectLabel } from "#shared/labels"
import { day, percent } from "../utils/format"
import type { CheckSource } from "#shared/rubric"
import { type CodeOrigin, fiveScale, queriedSource, sourceQuery } from "../utils/rubric"

const props = defineProps<{ project: ProjectView, runs: RunSummary[] }>()

// A rubric project starts empty: its files are the reference app, graded with the same rubric as every run.
const surfaces: AgentSessionSurface[] = props.project.rubric
  ? [
      { id: "rubric", label: "Rubric", icon: "i-lucide-clipboard-check", shortcut: "r" },
      { id: "files", label: "Reference app", icon: "i-lucide-files", shortcut: "f" },
    ]
  : [
      { id: "files", label: "Files", icon: "i-lucide-files", shortcut: "f" },
      { id: "preview", label: "Preview", icon: "i-lucide-app-window", shortcut: "v" },
      { id: "probes", label: "Probes", icon: "i-lucide-list-checks", shortcut: "p" },
    ]
const appLabel = computed(() => props.project.rubric ? "Reference app" : "Starting app")
const majors = computed(() => props.project.rubric?.checks.filter(check => check.major).length ?? 0)

const items = computed<AgentSessionItem[]>(() => props.project.prompt
  ? [{ type: "divider", id: "prompt-label", label: props.project.rubric ? "The prompt every run gets, in an empty folder" : "The prompt every run gets" }, { type: "assistant", id: "prompt", text: props.project.prompt }]
  : [])
const layerTitles: Record<ProjectProbe["layer"], string> = { gate: "Gate", runtime: "Runtime", static: "Static", judge: "Judge" }
const layers = computed(() => (["gate", "runtime", "static", "judge"] as const)
  .map(layer => ({ layer, probes: props.project.probes.filter(probe => probe.layer === layer) }))
  .filter(group => group.probes.length))
// As on a run page: `?file=<path>&line=6-9` opens the file in the Files surface, `#check-D10` the check in the Rubric.
const agentSession = ref<{ openSurface: (id: string) => void }>()
const route = useRoute()
const router = useRouter()
const focus = ref<CheckSource>()
const projectHref = (source: CheckSource) => `/projects/${props.project.project}?${sourceQuery(source)}`

function follow() {
  const source = queriedSource(route.query)
  if (source) {
    focus.value = source
    agentSession.value?.openSurface("files")
  }
  else if (route.hash.startsWith("#check-") && props.project.rubric) agentSession.value?.openSurface("rubric")
}
// The session's template ref is set after this component mounts (Nuxt renders client components late), so follow the
// address once it is there.
watch(agentSession, session => session && follow(), { once: true })
watch(() => route.fullPath, follow)

const origin: CodeOrigin = {
  key: `project:${props.project.project}`,
  read: async path => (await $fetch<{ content: string }>(`/api/projects/${props.project.project}/file`, { query: { path } })).content,
  href: projectHref,
  open(source) {
    const href = projectHref(source)
    if (route.fullPath === href) follow()
    else void router.push(href)
  },
}

const best = computed(() => props.runs.reduce<RunSummary | undefined>((top, run) => !top || run.score > top.score ? run : top, undefined))
</script>

<template>
  <AgentSession
    ref="agentSession"
    :title="projectLabel(project.project)"
    :subtitle="project.title"
    :surfaces="surfaces"
    :storage-key="project.rubric ? 'nuxt-evals:rubric-project-layout' : 'nuxt-evals:project-layout'"
    :default-surface="project.rubric ? 'rubric' : 'files'"
    :default-panel-open="true"
    :default-width="640"
  >
    <template #heading>
      <NuxtLink
        :to="{ path: '/', query: { project: project.project } }"
        class="text-sm text-dimmed transition-colors hover:text-highlighted"
      >
        Results
      </NuxtLink>
      <span
        class="text-dimmed"
        aria-hidden="true"
      >/</span>
      <h1 class="vh-agent-session__title">
        {{ projectLabel(project.project) }}
      </h1>
      <span class="vh-agent-session__subtitle">{{ appLabel }} · {{ project.title }}</span>
    </template>

    <AgentSessionTimeline
      v-if="items.length"
      :items="items"
    />
    <p
      v-else
      class="px-1 py-6 text-sm text-muted"
    >
      The prompt is not on the site yet. Run <code>pnpm evals base {{ project.project }}</code>.
    </p>

    <template #details>
      <AgentSessionDetailsSection
        v-if="project.rubric"
        title="Rubric"
      >
        <AgentSessionDetailsRow
          icon="i-lucide-list-checks"
          label="Checks"
          :value="`${project.rubric.checks.length} in ${project.rubric.sections.length} sections`"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-triangle-alert"
          label="Major"
          :value="majors"
          tone="muted"
        />
        <AgentSessionDetailsRow
          v-if="project.reference"
          icon="i-lucide-medal"
          label="Reference app"
          :value="`${fiveScale(project.reference.score)} of 5`"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection :title="appLabel">
        <AgentSessionDetailsRow
          icon="i-lucide-git-commit-horizontal"
          label="Revision"
          :value="project.revision.slice(0, 8)"
          :title="project.revision"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-files"
          label="Files"
          :value="project.paths.length"
        />
        <AgentSessionDetailsRow
          icon="i-lucide-calendar"
          label="Updated"
          :value="`${day(project.createdAt)} UTC`"
          tone="muted"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection
        v-if="project.stack.length"
        title="Stack"
      >
        <AgentSessionDetailsRow
          v-for="item in project.stack"
          :key="item.name"
          icon="i-lucide-package"
          :label="item.name"
          :value="item.version"
          :title="item.version"
          tone="muted"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection
        v-if="layers.length"
        title="Probes"
      >
        <AgentSessionDetailsRow
          v-for="group in layers"
          :key="group.layer"
          icon="i-lucide-list-checks"
          :label="layerTitles[group.layer]"
          :value="group.probes.length"
        />
      </AgentSessionDetailsSection>
      <AgentSessionDetailsSection title="Runs">
        <AgentSessionDetailsRow
          icon="i-lucide-play"
          label="Runs"
          :value="runs.length"
        />
        <AgentSessionDetailsRow
          v-if="best"
          icon="i-lucide-trophy"
          label="Best score"
          :value="best.rubric ? `${fiveScale(best.score * 5)} of 5` : percent(best.score)"
          :href="`/runs/${best.id}`"
        />
      </AgentSessionDetailsSection>
    </template>

    <template #surface-rubric>
      <RubricGradeView
        v-if="project.reference"
        :grade="project.reference"
        :rubric="project.rubric"
        grade-label="Reference app"
        :origin="origin"
      />
      <p
        v-else
        class="border-t border-default px-4 py-6 text-sm text-muted"
      >
        The reference app has no grade yet. Run <code>pnpm evals judge reference</code>, then <code>pnpm evals base {{ project.project }}</code>.
      </p>
    </template>

    <template #surface-files>
      <BaseWorkspace
        :project="project.project"
        :paths="project.paths"
        :focus="focus"
      />
    </template>

    <template #surface-preview>
      <AppPreview
        :source="`/api/projects/${project.project}/files`"
        :label="`the ${projectLabel(project.project)} starting app`"
      />
    </template>

    <template #surface-probes>
      <div class="min-h-0 flex-1 overflow-y-auto border-t border-default px-3 py-3">
        <p
          v-if="!layers.length"
          class="px-2.5 py-3 text-sm text-muted"
        >
          The probes are not on the site yet.
        </p>
        <section
          v-for="group in layers"
          :key="group.layer"
          class="mb-4"
        >
          <h3 class="mb-1 flex h-8 items-center px-2.5 text-[11px] font-medium text-muted">
            {{ layerTitles[group.layer] }}
            <span class="ml-auto tabular-nums text-dimmed">{{ group.probes.length }}</span>
          </h3>
          <ul>
            <li
              v-for="probe in group.probes"
              :key="probe.id"
              class="rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-elevated/60"
            >
              <InlineCode
                class="text-default"
                :text="probe.title"
              />
              <span
                v-if="probe.why"
                class="block text-xs text-muted"
              ><InlineCode :text="probe.why" /></span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </AgentSession>
</template>

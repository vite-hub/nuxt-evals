<script setup lang="ts">
import { computed } from "vue"
import type { ProjectView, RunSummary } from "#shared/report"
import type { RubricGrade } from "#shared/rubric"
import { harnessLabel, modelLabel } from "#shared/labels"
import { fiveScale, median, medianSections, plainCheck } from "../utils/rubric"

/**
 * The rubric view of a project's results: one row per agent setup with its median section scores, under the reference
 * app's row, then the checks the shown runs fail most often.
 */
const props = defineProps<{ runs: RunSummary[], project?: ProjectView | null }>()

const sections = computed(() => props.project?.rubric?.sections ?? props.runs[0]?.rubric?.sections.map(section => ({ key: section.key, number: 0, title: section.key })) ?? [])
const checks = computed(() => new Map(props.project?.rubric?.checks.map(check => [check.id, check]) ?? []))
const reference = computed(() => props.project?.reference)

const graded = computed(() => props.runs.filter((run): run is RunSummary & { rubric: RubricGrade } => Boolean(run.rubric)))

const groups = computed(() => {
  const map = new Map<string, (RunSummary & { rubric: RubricGrade })[]>()
  for (const run of graded.value) {
    const key = [run.harness, run.model, run.reasoning, run.setup].join("|")
    map.set(key, [...(map.get(key) ?? []), run])
  }
  return [...map.entries()].map(([key, list]) => ({
    key,
    harness: list[0]!.harness,
    label: `${harnessLabel(list[0]!.harness)} · ${modelLabel(list[0]!.model)} ${list[0]!.reasoning} · ${list[0]!.setup}`,
    score: median(list.map(run => run.rubric.score)),
    sections: medianSections(list.map(run => run.rubric)),
    runs: [...list].sort((a, b) => a.repeat - b.repeat),
  })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
})

/** Checks failed by at least one shown run, most failed first. Majors first on ties. */
const failing = computed(() => {
  const counts = new Map<string, RunSummary[]>()
  for (const run of graded.value) {
    for (const check of run.rubric.checks) if (check.outcome === "fail") counts.set(check.id, [...(counts.get(check.id) ?? []), run])
  }
  return [...counts.entries()].map(([id, runs]) => ({
    id,
    runs,
    check: checks.value.get(id),
    reference: reference.value?.checks.find(check => check.id === id)?.outcome,
  })).sort((a, b) => b.runs.length - a.runs.length || Number(b.check?.major ?? false) - Number(a.check?.major ?? false) || a.id.localeCompare(b.id, undefined, { numeric: true }))
})

function sectionTitle(key: string) {
  return sections.value.find(section => section.key === key)?.title ?? key
}

function scoreOf(grade: Pick<RubricGrade, "sections">, key: string) {
  return grade.sections.find(section => section.key === key)?.score ?? null
}
</script>

<template>
  <div>
    <section class="border-b border-default px-5 pb-8 pt-6">
      <h2 class="text-sm font-medium text-highlighted">
        Sections
      </h2>
      <p class="mt-1 max-w-prose text-sm text-pretty text-muted">
        Each section of the rubric scores 1 to 5. A row of runs shows its median per section. The reference app is the yardstick: the judge grades it with the same rubric.
      </p>
      <div class="mt-4 overflow-x-auto">
        <table class="text-sm">
          <thead>
            <tr class="text-left text-xs text-muted">
              <th class="sticky left-0 z-[1] bg-default py-2 pr-4 font-normal">
                Agent and setup
              </th>
              <th class="px-1 py-2 text-center font-normal">
                Mean
              </th>
              <th
                v-for="section in sections"
                :key="section.key"
                class="px-0.5 py-2 text-center font-mono font-normal"
                :title="section.title"
              >
                <abbr
                  :title="section.title"
                  class="no-underline"
                >{{ section.key }}</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="reference"
              class="border-t border-default"
            >
              <th class="sticky left-0 z-[1] bg-default py-2 pr-4 text-left font-normal">
                <NuxtLink
                  :to="`/projects/${project!.project}`"
                  class="font-medium text-highlighted hover:underline hover:underline-offset-4"
                >Reference app</NuxtLink>
                <span class="ml-2 text-xs text-muted">Nuxt 5 + ViteHub</span>
              </th>
              <td class="px-1 py-2 text-center">
                <ScoreCell
                  :score="reference.score"
                  size="md"
                  label="Reference app, mean"
                />
              </td>
              <td
                v-for="section in sections"
                :key="section.key"
                class="px-0.5 py-2 text-center"
              >
                <ScoreCell
                  :score="scoreOf(reference, section.key)"
                  :label="`Reference app, ${section.title}`"
                />
              </td>
            </tr>
            <template
              v-for="group in groups"
              :key="group.key"
            >
              <tr class="border-t border-default">
                <th class="sticky left-0 z-[1] bg-default py-2 pr-4 text-left font-normal">
                  <span
                    class="font-medium tone-text"
                    :class="group.harness"
                  >{{ group.label }}</span>
                  <span class="ml-2 text-xs text-muted">median of {{ group.runs.length }}</span>
                </th>
                <td class="px-1 py-2 text-center">
                  <ScoreCell
                    :score="group.score"
                    size="md"
                    :label="`${group.label}, mean`"
                  />
                </td>
                <td
                  v-for="section in group.sections"
                  :key="section.key"
                  class="px-0.5 py-2 text-center"
                >
                  <ScoreCell
                    :score="section.score"
                    :label="`${group.label}, ${sectionTitle(section.key)}`"
                  />
                </td>
              </tr>
              <tr
                v-for="run in group.runs"
                :key="run.id"
              >
                <th class="sticky left-0 z-[1] bg-default py-1 pl-4 pr-4 text-left text-xs font-normal">
                  <NuxtLink
                    :to="`/runs/${run.id}`"
                    class="text-muted hover:text-highlighted hover:underline hover:underline-offset-4"
                  >Run {{ run.setup }}{{ run.repeat }}</NuxtLink>
                  <span
                    v-if="!run.rubric.started"
                    class="ml-2 text-error"
                  >did not start</span>
                </th>
                <td class="px-1 py-1 text-center text-xs tabular-nums text-muted">
                  {{ fiveScale(run.rubric.score) }}
                </td>
                <td
                  v-for="section in run.rubric.sections"
                  :key="section.key"
                  class="px-0.5 py-1 text-center"
                >
                  <NuxtLink
                    :to="`/runs/${run.id}#section-${section.key}`"
                    class="inline-flex opacity-75 hover:opacity-100"
                  >
                    <ScoreCell
                      :score="section.score"
                      :label="`Run ${run.setup}${run.repeat}, ${sectionTitle(section.key)}`"
                      class="size-5 text-[10px]"
                    />
                  </NuxtLink>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span
          v-for="score in [5, 4, 3, 2, 1]"
          :key="score"
          class="inline-flex items-center gap-1.5"
        >
          <ScoreCell
            :score="score"
            class="size-4 text-[9px]"
          />
          {{ score === 5 ? "every major passes, at most 1 minor fails" : score === 4 ? "2 or 3 minor fail" : score === 3 ? "1 major or 4+ minor fail" : score === 2 ? "2 or 3 major fail" : "4+ major fail, or broken" }}
        </span>
      </p>
    </section>

    <section
      v-if="failing.length"
      class="border-b border-default px-5 pb-8 pt-6"
    >
      <h2 class="text-sm font-medium text-highlighted">
        Checks the runs fail
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ failing.length }} of {{ checks.size }} checks failed in at least one of {{ graded.length }} runs. Most failed first.
      </p>
      <ul class="mt-3 text-sm">
        <li
          v-for="row in failing"
          :key="row.id"
          class="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-default py-2"
        >
          <span class="font-mono text-xs text-muted">{{ row.id }}</span>
          <span class="min-w-0">
            <span
              v-if="row.check?.major"
              class="mr-1.5 rounded-sm bg-error/10 px-1 text-[11px] font-medium text-error"
            >major</span>
            <InlineCode
              class="text-default"
              :text="row.check ? plainCheck(row.check.text) : row.id"
            />
            <span
              v-if="row.reference && row.reference !== 'pass'"
              class="ml-1.5 text-xs text-dimmed"
            >(reference: {{ row.reference }})</span>
          </span>
          <span class="flex items-baseline gap-2 whitespace-nowrap text-xs">
            <span class="tabular-nums font-medium text-highlighted">{{ row.runs.length }}/{{ graded.length }}</span>
            <NuxtLink
              v-for="run in row.runs"
              :key="run.id"
              :to="`/runs/${run.id}#check-${row.id}`"
              class="link"
            >{{ run.setup }}{{ run.repeat }}</NuxtLink>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

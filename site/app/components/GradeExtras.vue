<script setup lang="ts">
import { computed } from "vue"
import type { CheckSource, RubricGrade, VibeFinding } from "#shared/rubric"
import { type CodeOrigin, sourceLabel } from "../utils/rubric"

/** The two scores beside the rubric: Vite Doctor (10% of the headline) and the vibe pass (shown, not counted). */
const props = defineProps<{ grade: RubricGrade, origin?: CodeOrigin }>()

const doctor = computed(() => props.grade.doctor)
const vibe = computed(() => props.grade.vibe)
/** Charged diagnostics first, then the ones whose rule also fires on the reference. */
const diagnostics = computed(() => [...(doctor.value?.diagnostics ?? [])]
  .map(diagnostic => ({ ...diagnostic, baseline: doctor.value?.baselineRules.includes(diagnostic.rule) ?? false }))
  .sort((a, b) => Number(a.baseline) - Number(b.baseline) || a.rule.localeCompare(b.rule)))
const kinds: Record<VibeFinding["kind"], string> = {
  "missing-abstraction": "Missing abstraction",
  "superfluous-abstraction": "Superfluous",
  "reinvented": "Reinvented",
  "structure": "Structure",
  "elegant": "Elegant",
}

function open(source: CheckSource, event: MouseEvent) {
  if (!props.origin?.open) return
  event.preventDefault()
  props.origin.open(source)
}
</script>

<template>
  <div v-if="doctor || vibe" class="border-b border-default">
    <details v-if="vibe" class="border-b border-default px-4 py-3 text-sm last:border-b-0">
      <summary class="flex cursor-pointer items-center gap-3">
        <ScoreCell :score="vibe.score" label="Vibe" />
        <span class="font-medium text-highlighted">Vibe</span>
        <span class="text-xs text-muted">Design a linter can't see. Not part of the score.</span>
      </summary>
      <p class="mt-3 max-w-prose text-pretty text-default">
        {{ vibe.summary }}
      </p>
      <ul class="mt-3 flex flex-col gap-2">
        <li v-for="(finding, index) in vibe.findings" :key="index" class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 max-sm:grid-cols-1 max-sm:gap-1">
          <span class="text-xs text-muted" :class="{ 'text-success': finding.kind === 'elegant' }">{{ kinds[finding.kind] }}</span>
          <span>
            {{ finding.text }}
            <a
              v-for="source in finding.sources ?? []"
              :key="sourceLabel(source)"
              :href="origin?.href(source)"
              class="ml-1.5 font-mono text-xs link"
              @click="open(source, $event)"
            >{{ sourceLabel(source) }}</a>
          </span>
        </li>
      </ul>
    </details>
    <details v-if="doctor" class="px-4 py-3 text-sm">
      <summary class="flex cursor-pointer items-center gap-3">
        <ScoreCell :score="doctor.score" label="Vite Doctor" />
        <span class="font-medium text-highlighted">Vite Doctor</span>
        <span class="text-xs text-muted">
          {{ doctor.points }} points{{ doctor.version ? ` · vite-doctor ${doctor.version}` : "" }} · 10% of the score
        </span>
      </summary>
      <p class="mt-3 max-w-prose text-pretty text-xs text-muted">
        Errors weigh 3 and warnings 1, each rule at most 5 times; the score is 10 × 15 / (15 + points), so 10 means none.
        Rules that also fire on the reference app don't count.
        <template v-if="doctor.note">
          {{ doctor.note }}
        </template>
      </p>
      <ul v-if="diagnostics.length" class="mt-3 flex flex-col gap-1.5">
        <li v-for="(diagnostic, index) in diagnostics" :key="index" class="grid grid-cols-[4rem_minmax(0,1fr)] gap-3" :class="{ 'opacity-60': diagnostic.baseline }">
          <span class="font-mono text-xs" :class="diagnostic.severity === 'error' || diagnostic.severity === 'blocker' ? 'text-error' : 'text-muted'">{{ diagnostic.severity }}</span>
          <span>
            <span class="font-mono text-xs text-muted">{{ diagnostic.rule }}</span>
            <a
              v-if="diagnostic.path"
              :href="origin?.href({ path: diagnostic.path, line: diagnostic.line ?? 0 })"
              class="ml-1.5 font-mono text-xs link"
              @click="open({ path: diagnostic.path, line: diagnostic.line ?? 0 }, $event)"
            >{{ diagnostic.path }}{{ diagnostic.line ? `:${diagnostic.line}` : "" }}</a>
            <span class="block text-default">{{ diagnostic.message }}</span>
          </span>
        </li>
      </ul>
      <p v-else class="mt-2 text-muted">
        No diagnostics.
      </p>
    </details>
  </div>
</template>

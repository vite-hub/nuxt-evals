<script setup lang="ts">
import { computed } from "vue"
import type { CheckOutcome, CheckResult, Rubric, RubricGrade } from "#shared/rubric"
import { modelLabel } from "#shared/labels"
import { day } from "../utils/format"
import { fiveScale, plainCheck } from "../utils/rubric"

/**
 * A grade against the rubric, section by section. With `compare` (the reference app's grade), each section shows both
 * scores and each failed check shows what the reference did.
 */
const props = defineProps<{ grade: RubricGrade, rubric?: Rubric, gradeLabel?: string, compare?: RubricGrade, compareLabel?: string }>()

const outcomeIcon: Record<CheckOutcome, string> = { pass: "i-lucide-check", fail: "i-lucide-x", na: "i-lucide-minus", unverified: "i-lucide-circle-help" }
const outcomeLabel: Record<CheckOutcome, string> = { pass: "Pass", fail: "Fail", na: "n/a", unverified: "Unverified" }

const results = computed(() => new Map(props.grade.checks.map(check => [check.id, check])))
const compared = computed(() => new Map(props.compare?.checks.map(check => [check.id, check]) ?? []))

const sections = computed(() => props.grade.sections.map((score) => {
  const meta = props.rubric?.sections.find(section => section.key === score.key)
  const checks = (props.rubric?.checks.filter(check => check.section === score.key) ?? props.grade.checks.filter(check => check.id.startsWith(score.key)).map(check => ({ id: check.id, section: score.key, text: "", method: "read" as const, major: false })))
    .map(check => ({ ...check, result: results.value.get(check.id), reference: compared.value.get(check.id) }))
  return {
    ...score,
    title: meta?.title ?? score.key,
    number: meta?.number,
    reference: props.compare?.sections.find(section => section.key === score.key)?.score,
    failed: checks.filter(check => check.result?.outcome === "fail").sort((a, b) => Number(b.major) - Number(a.major)),
    unverified: checks.filter(check => !check.result || check.result.outcome === "unverified"),
    passed: checks.filter(check => check.result?.outcome === "pass" || check.result?.outcome === "na"),
  }
}))

const failedCount = computed(() => props.grade.checks.filter(check => check.outcome === "fail").length)
const unverifiedCount = computed(() => props.grade.checks.filter(check => check.outcome === "unverified").length)
const judgeMinutes = computed(() => Math.round(Math.max(0, ...props.grade.sessions.map(session => session.durationMs)) / 60_000))

function evidence(result?: CheckResult) {
  return result?.evidence ?? ""
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto border-t border-default">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-default px-4 py-4">
      <div class="flex items-center gap-3">
        <ScoreCell
          :score="grade.score"
          size="md"
        />
        <div class="text-sm">
          <p class="font-medium text-highlighted">
            {{ fiveScale(grade.score) }} of 5
          </p>
          <p class="text-xs text-muted">
            Mean of {{ grade.sections.filter(section => section.score !== null).length }} sections
          </p>
        </div>
      </div>
      <div
        v-if="compare"
        class="flex items-center gap-3"
      >
        <ScoreCell
          :score="compare.score"
          size="md"
        />
        <div class="text-sm">
          <p class="font-medium text-highlighted">
            {{ fiveScale(compare.score) }} of 5
          </p>
          <p class="text-xs text-muted">
            {{ compareLabel ?? "Reference" }}
          </p>
        </div>
      </div>
      <p class="ml-auto text-right text-xs text-muted">
        {{ failedCount }} failed · {{ unverifiedCount }} unverified<br>
        Judge: {{ modelLabel(grade.judge.model) }} {{ grade.judge.effort }} · {{ day(grade.gradedAt) }} UTC · {{ judgeMinutes }} min
      </p>
    </div>

    <p
      v-if="!grade.started"
      class="mx-4 mt-4 rounded-sm border border-error/40 bg-error/5 px-3 py-2 text-sm text-highlighted"
    >
      The app did not build or start, so every section scores 1. The setup grader's notes are below.
    </p>

    <details
      v-if="grade.setupNotes"
      class="border-b border-default px-4 py-3 text-sm"
    >
      <summary class="cursor-pointer text-muted hover:text-highlighted">
        How the judge built and started the app
      </summary>
      <p class="mt-2 whitespace-pre-wrap text-pretty text-default">
        {{ grade.setupNotes }}
      </p>
    </details>

    <section
      v-for="section in sections"
      :id="`section-${section.key}`"
      :key="section.key"
      class="border-b border-default px-4 py-3"
    >
      <h3 class="flex items-center gap-3">
        <span class="w-5 font-mono text-xs text-dimmed">{{ section.key }}</span>
        <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ section.title }}</span>
        <ScoreCell
          :score="section.score"
          :label="gradeLabel ?? 'This run'"
        />
        <ScoreCell
          v-if="compare"
          :score="section.reference"
          :label="compareLabel ?? 'Reference'"
          class="opacity-60"
        />
      </h3>

      <ul
        v-if="section.failed.length"
        class="mt-2 space-y-2"
      >
        <li
          v-for="check in section.failed"
          :id="`check-${check.id}`"
          :key="check.id"
          class="flex gap-2.5 text-[13px]"
        >
          <UIcon
            name="i-lucide-x"
            class="mt-0.5 size-4 shrink-0 text-error"
          />
          <div class="min-w-0 flex-1">
            <p class="text-highlighted">
              <span class="font-mono text-xs text-muted">{{ check.id }}</span>
              <span
                v-if="check.major"
                class="ml-1.5 rounded-sm bg-error/10 px-1 text-[11px] font-medium text-error"
              >major</span>
              <InlineCode
                class="ml-1.5"
                :text="plainCheck(check.text)"
              />
            </p>
            <p class="mt-1 border-l-2 border-error/40 pl-2.5 text-pretty text-muted">
              <InlineCode :text="evidence(check.result)" />
            </p>
            <p
              v-if="check.reference && compare"
              class="mt-1 text-xs text-dimmed"
            >
              {{ compareLabel ?? "Reference" }}: {{ outcomeLabel[check.reference.outcome].toLowerCase() }}
            </p>
          </div>
        </li>
      </ul>

      <details
        v-if="section.passed.length || section.unverified.length"
        class="mt-2 text-[13px]"
      >
        <summary class="cursor-pointer text-xs text-muted hover:text-highlighted">
          {{ section.passed.length }} passed<template v-if="section.unverified.length">
            · {{ section.unverified.length }} unverified
          </template>
        </summary>
        <ul class="mt-2 space-y-2">
          <li
            v-for="check in [...section.unverified, ...section.passed]"
            :id="`check-${check.id}`"
            :key="check.id"
            class="flex gap-2.5"
          >
            <UIcon
              :name="outcomeIcon[check.result?.outcome ?? 'unverified']"
              class="mt-0.5 size-4 shrink-0 text-muted"
              :aria-label="outcomeLabel[check.result?.outcome ?? 'unverified']"
            />
            <div class="min-w-0 flex-1">
              <p class="text-default">
                <span class="font-mono text-xs text-muted">{{ check.id }}</span>
                <InlineCode
                  class="ml-1.5"
                  :text="plainCheck(check.text)"
                />
              </p>
              <p
                v-if="check.result?.evidence"
                class="mt-0.5 text-pretty text-xs text-dimmed"
              >
                <InlineCode :text="check.result.evidence" />
              </p>
            </div>
          </li>
        </ul>
      </details>
    </section>
  </div>
</template>

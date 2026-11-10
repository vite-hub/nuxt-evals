<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue"
import type { CheckOutcome, CheckResult, Rubric, RubricCheck, RubricGrade } from "#shared/rubric"
import { modelLabel } from "#shared/labels"
import { day } from "../utils/format"
import { type CodeOrigin, checkLinks, fiveScale, plainCheck } from "../utils/rubric"

/**
 * A grade against the rubric, section by section. Every check opens into a diagnostic (why, sources, fix, expected,
 * see). With `compare` (the reference app's grade), each section shows both scores and a check the run doesn't pass
 * shows the reference's passing code as "expected". `origin` and `compareOrigin` are the apps the sources point into.
 */
const props = defineProps<{
  grade: RubricGrade
  rubric?: Rubric
  gradeLabel?: string
  compare?: RubricGrade
  compareLabel?: string
  origin?: CodeOrigin
  compareOrigin?: CodeOrigin
}>()

const outcomeIcon: Record<CheckOutcome, string> = { pass: "i-lucide-check", fail: "i-lucide-x", na: "i-lucide-minus", unverified: "i-lucide-circle-help" }
const outcomeLabel: Record<CheckOutcome, string> = { pass: "Pass", fail: "Fail", na: "n/a", unverified: "Unverified" }

const results = computed(() => new Map(props.grade.checks.map(check => [check.id, check])))
const compared = computed(() => new Map(props.compare?.checks.map(check => [check.id, check]) ?? []))

type Row = RubricCheck & { result?: CheckResult, reference?: CheckResult }

const sections = computed(() => props.grade.sections.map((score) => {
  const meta = props.rubric?.sections.find(section => section.key === score.key)
  const checks: Row[] = (props.rubric?.checks.filter(check => check.section === score.key) ?? props.grade.checks.filter(check => check.id.startsWith(score.key)).map(check => ({ id: check.id, section: score.key, text: "", method: "read" as const, major: false })))
    .map(check => ({ ...check, result: results.value.get(check.id), reference: compared.value.get(check.id) }))
  return {
    ...score,
    title: meta?.title ?? score.key,
    number: meta?.number,
    docs: meta?.docs ?? [],
    reference: props.compare?.sections.find(section => section.key === score.key)?.score,
    failed: checks.filter(check => check.result?.outcome === "fail").sort((a, b) => Number(b.major) - Number(a.major)),
    unverified: checks.filter(check => !check.result || check.result.outcome === "unverified"),
    passed: checks.filter(check => check.result?.outcome === "pass" || check.result?.outcome === "na"),
  }
}))

const failedCount = computed(() => props.grade.checks.filter(check => check.outcome === "fail").length)
const unverifiedCount = computed(() => props.grade.checks.filter(check => check.outcome === "unverified").length)
const judgeMinutes = computed(() => Math.round(Math.max(0, ...props.grade.sessions.map(session => session.durationMs)) / 60_000))

/** The check's own links first, then its section's docs, each url once. */
function see(check: Row, docs: { label: string, url: string }[]) {
  const links = [...checkLinks(check.text), ...docs]
  return links.filter((link, index) => links.findIndex(other => other.url === link.url) === index)
}

/** The reference's result, shown as "expected" when it passed a check this grade doesn't. */
const expected = (check: Row) => check.reference?.outcome === "pass" && check.result?.outcome !== "pass" ? check.reference : undefined

// Open checks and open "passed" groups. The address bar names the last check opened: `#check-D10`.
const open = reactive(new Set<string>())
const openGroups = reactive(new Set<string>())
const root = ref<HTMLElement>()
const route = useRoute()

/**
 * Puts `#check-<id>` in the address without a navigation: through the router, Nuxt's scroll behavior would scroll the
 * page to the row. `current` is the router's record of the entry, so a later push keeps the hash in history.
 */
function writeHash(id: string | undefined) {
  const url = new URL(location.href)
  url.hash = id ? `check-${id}` : ""
  // A link to a check is a link to the rubric, so the file a source link opened leaves the address.
  url.searchParams.delete("file")
  url.searchParams.delete("line")
  const path = `${url.pathname}${url.search}${url.hash}`
  if (path !== `${location.pathname}${location.search}${location.hash}`) history.replaceState({ ...history.state, current: path }, "", path)
}

function toggle(id: string) {
  if (open.has(id)) {
    open.delete(id)
    if (location.hash === `#check-${id}`) writeHash([...open].at(-1))
  }
  else {
    open.add(id)
    writeHash(id)
  }
}

/** Opens the check the address names, and its "passed" group, and scrolls it into view inside the panel. */
async function openFromHash() {
  const id = route.hash.startsWith("#check-") ? decodeURIComponent(route.hash.slice("#check-".length)) : undefined
  if (!id || !results.value.has(id)) return
  open.add(id)
  const section = sections.value.find(item => [...item.passed, ...item.unverified].some(check => check.id === id))
  if (section) openGroups.add(section.key)
  await nextTick()
  // Scroll the panel only: scrollIntoView would also scroll the page under the site header. For the same reason no
  // element has the id `check-D10`: the router's hash scrolling would scroll the page.
  const row = root.value?.querySelector(`[data-check="${CSS.escape(id)}"]`)
  if (row && root.value) root.value.scrollTop += row.getBoundingClientRect().top - root.value.getBoundingClientRect().top - 12
}

onMounted(openFromHash)
// Opening a check writes the hash itself and needs no scroll; a hash from elsewhere (a link, back) does.
watch(() => route.hash, (hash) => {
  if (hash.startsWith("#check-") && !open.has(decodeURIComponent(hash.slice("#check-".length)))) void openFromHash()
})
// On a run page the rubric's text arrives after the grade, and the rows grow; land on the check again.
watch(() => props.rubric, () => void openFromHash())

function onGroupToggle(key: string, event: Event) {
  if ((event.target as HTMLDetailsElement).open) openGroups.add(key)
  else openGroups.delete(key)
}
</script>

<template>
  <div
    ref="root"
    class="@container min-h-0 flex-1 overflow-y-auto border-t border-default"
  >
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
        class="mt-2 space-y-1"
      >
        <li
          v-for="check in section.failed"
          :data-check="check.id"
          :key="check.id"
          class="text-[13px]"
        >
          <button
            type="button"
            class="check-row"
            :aria-expanded="open.has(check.id)"
            :aria-controls="`check-detail-${check.id}`"
            @click="toggle(check.id)"
          >
            <UIcon
              name="i-lucide-x"
              class="mt-0.5 size-4 shrink-0 text-error"
              aria-label="Fail"
            />
            <span class="min-w-0 flex-1">
              <span class="block text-highlighted">
                <span class="font-mono text-xs text-muted">{{ check.id }}</span>
                <span
                  v-if="check.major"
                  class="ml-1.5 rounded-sm bg-error/10 px-1 text-[11px] font-medium text-error"
                >major</span>
                <InlineCode
                  class="ml-1.5"
                  :text="plainCheck(check.text)"
                />
              </span>
              <template v-if="!open.has(check.id)">
                <span class="mt-1 line-clamp-2 border-l-2 border-error/40 pl-2.5 text-pretty text-muted">
                  <InlineCode :text="check.result?.evidence ?? ''" />
                </span>
                <span
                  v-if="check.reference && compare"
                  class="mt-1 block text-xs text-dimmed"
                >
                  {{ compareLabel ?? "Reference" }}: {{ outcomeLabel[check.reference.outcome].toLowerCase() }}
                </span>
              </template>
            </span>
            <UIcon
              name="i-lucide-chevron-down"
              class="check-row-chevron mt-0.5 size-4 shrink-0 text-dimmed"
            />
          </button>
          <RubricCheckDetail
            v-if="open.has(check.id)"
            :id="`check-detail-${check.id}`"
            class="mt-1.5 mb-3 ml-6.5"
            :result="check.result"
            :origin="origin"
            :expected="expected(check)"
            :expected-origin="compareOrigin"
            :expected-label="compareLabel"
            :see="see(check, section.docs)"
          />
        </li>
      </ul>

      <details
        v-if="section.passed.length || section.unverified.length"
        class="mt-2 text-[13px]"
        :open="openGroups.has(section.key)"
        @toggle="onGroupToggle(section.key, $event)"
      >
        <summary class="cursor-pointer text-xs text-muted hover:text-highlighted">
          {{ section.passed.length }} passed<template v-if="section.unverified.length">
            · {{ section.unverified.length }} unverified
          </template>
        </summary>
        <ul class="mt-2 space-y-1">
          <li
            v-for="check in [...section.unverified, ...section.passed]"
            :data-check="check.id"
            :key="check.id"
          >
            <button
              type="button"
              class="check-row"
              :aria-expanded="open.has(check.id)"
              :aria-controls="`check-detail-${check.id}`"
              @click="toggle(check.id)"
            >
              <UIcon
                :name="outcomeIcon[check.result?.outcome ?? 'unverified']"
                class="mt-0.5 size-4 shrink-0 text-muted"
                :aria-label="outcomeLabel[check.result?.outcome ?? 'unverified']"
              />
              <span class="min-w-0 flex-1">
                <span class="block text-default">
                  <span class="font-mono text-xs text-muted">{{ check.id }}</span>
                  <InlineCode
                    class="ml-1.5"
                    :text="plainCheck(check.text)"
                  />
                </span>
                <span
                  v-if="check.result?.evidence && !open.has(check.id)"
                  class="mt-0.5 line-clamp-2 text-pretty text-xs text-dimmed"
                >
                  <InlineCode :text="check.result.evidence" />
                </span>
              </span>
              <UIcon
                name="i-lucide-chevron-down"
                class="check-row-chevron mt-0.5 size-4 shrink-0 text-dimmed"
              />
            </button>
            <RubricCheckDetail
              v-if="open.has(check.id)"
              :id="`check-detail-${check.id}`"
              class="mt-1.5 mb-3 ml-6.5"
              :result="check.result"
              :origin="origin"
              :expected="expected(check)"
              :expected-origin="compareOrigin"
              :expected-label="compareLabel"
              :see="see(check, section.docs)"
            />
          </li>
        </ul>
      </details>
    </section>
  </div>
</template>

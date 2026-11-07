<script setup lang="ts">
import { computed, ref } from "vue"
import type { RunDetail } from "../../../shared/report"
import { day, percent, seconds, tokens } from "../../utils/format"

const route = useRoute()
const { data: run, error } = await useFetch<RunDetail>(`/api/runs/${route.params.id}`, { key: `run-${route.params.id}` })
if (error.value || !run.value) throw createError({ status: error.value?.statusCode ?? 404, message: "Run not found.", fatal: true })

useSeoMeta({ title: () => `${run.value?.task} · Nuxt agent evals` })

const passed = computed(() => run.value?.probes.filter(probe => probe.passed).length ?? 0)

const toolLabels: Record<string, string> = { command_execution: "Shell", file_change: "Edit", web_search: "Web search" }

/** The agent's tool calls in order, read from the ViteHub event stream. */
const steps = computed(() => (run.value?.events ?? []).flatMap((raw) => {
  const item = raw as { type?: string, name?: string, input?: { command?: string, query?: string, path?: string } }
  if (item.type !== "tool-call") return []
  const command = item.input?.command?.replace(/^\/bin\/bash -lc "([\s\S]*)"$/, (_, inner: string) => inner.replace(/\\(["\\$`])/g, "$1")).replace(/^\/bin\/bash -lc '([\s\S]*)'$/, "$1")
  return [{ name: toolLabels[item.name ?? ""] ?? item.name ?? "Tool", detail: command ?? item.input?.query ?? item.input?.path ?? "" }]
}))

/** The answer is Markdown; show `code` spans as code and leave the rest as text. */
const answer = computed(() => (run.value?.finalText ?? "").split(/(`[^`\n]+`)/).map(part => ({
  code: part.startsWith("`") && part.endsWith("`") && part.length > 2,
  text: part.startsWith("`") && part.endsWith("`") && part.length > 2 ? part.slice(1, -1) : part,
})))

const diffLines = computed(() => (run.value?.diff ?? "").split("\n").map(text => ({
  text,
  tone: text.startsWith("+++") || text.startsWith("---") || text.startsWith("diff ") || text.startsWith("index ") ? "meta" : text.startsWith("@@") ? "hunk" : text.startsWith("+") ? "add" : text.startsWith("-") ? "del" : "ctx",
})))

const selected = ref(0)
const file = computed(() => run.value?.files[selected.value])
</script>

<template>
  <div
    v-if="run"
    class="pt-8"
  >
    <NuxtLink
      to="/"
      class="enter text-sm text-dimmed transition-colors hover:text-highlighted"
    >
      ← Runs
    </NuxtLink>

    <section
      class="enter pb-6 pt-6"
      style="--i: 1"
    >
      <h1 class="text-2xl font-medium tracking-tight text-highlighted">
        {{ run.task }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ run.agent }} {{ run.model }} · {{ run.reasoning }} effort · setup {{ run.setup }} · <time :datetime="run.startedAt">{{ day(run.startedAt) }} UTC</time>
      </p>

      <dl class="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-dimmed">
            Score
          </dt>
          <dd class="mt-1 text-lg font-medium tabular-nums text-highlighted">
            {{ percent(run.score) }}
          </dd>
        </div>
        <div>
          <dt class="text-dimmed">
            Probes
          </dt>
          <dd class="mt-1 text-lg font-medium tabular-nums text-highlighted">
            {{ passed }}/{{ run.probes.length }}
          </dd>
        </div>
        <div>
          <dt class="text-dimmed">
            Tokens in / out
          </dt>
          <dd class="mt-1 text-lg font-medium tabular-nums text-highlighted">
            {{ tokens(run.usage.inputTokens) }} / {{ tokens(run.usage.outputTokens) }}
          </dd>
          <dd class="text-xs tabular-nums text-dimmed">
            {{ tokens(run.usage.cachedInputTokens) }} cached
          </dd>
        </div>
        <div>
          <dt class="text-dimmed">
            Time
          </dt>
          <dd class="mt-1 text-lg font-medium tabular-nums text-highlighted">
            {{ seconds(run.durationMs) }}
          </dd>
          <dd class="text-xs tabular-nums text-dimmed">
            {{ run.diagnostics.toolCalls }} tool calls · {{ run.diagnostics.webFetches }} web
          </dd>
        </div>
      </dl>
      <p
        v-if="run.diagnostics.error"
        class="mt-6 text-sm text-(--fail)"
      >
        {{ run.diagnostics.error }}
      </p>
    </section>

    <section
      class="enter py-8"
      style="--i: 2"
    >
      <SectionLabel>Probes</SectionLabel>
      <ul class="text-sm">
        <li
          v-for="probe in run.probes"
          :key="probe.id"
          class="row flex items-baseline gap-3 py-2"
        >
          <UIcon
            :name="probe.passed ? 'i-lucide-check' : 'i-lucide-x'"
            class="size-3.5 shrink-0 translate-y-0.5"
            :class="probe.passed ? 'text-(--pass)' : 'text-(--fail)'"
            :aria-label="probe.passed ? 'Passed' : 'Failed'"
          />
          <span class="text-highlighted">{{ probe.title }}</span>
          <span class="ml-auto shrink-0 text-dimmed">{{ probe.layer }}</span>
        </li>
      </ul>
    </section>

    <section
      v-if="run.finalText"
      class="enter py-8"
      style="--i: 3"
    >
      <SectionLabel>Agent's answer</SectionLabel>
      <p class="max-w-prose whitespace-pre-line text-[15px] leading-7 text-pretty text-muted">
        <template
          v-for="(part, index) in answer"
          :key="index"
        >
          <code
            v-if="part.code"
            class="rounded-(--ui-radius) border border-default bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-highlighted"
          >{{ part.text }}</code>
          <template v-else>
            {{ part.text }}
          </template>
        </template>
      </p>
    </section>

    <section
      v-if="steps.length"
      class="enter py-8"
      style="--i: 4"
    >
      <SectionLabel>Steps</SectionLabel>
      <ol class="text-sm">
        <li
          v-for="(step, index) in steps"
          :key="index"
          class="row flex items-baseline gap-3 py-1.5"
        >
          <span class="w-5 shrink-0 text-right tabular-nums text-dimmed">{{ index + 1 }}</span>
          <span class="w-20 shrink-0 text-muted">{{ step.name }}</span>
          <code
            class="min-w-0 truncate font-mono text-xs text-default"
            :title="step.detail"
          >{{ step.detail }}</code>
        </li>
      </ol>
    </section>

    <section
      class="enter py-8"
      style="--i: 5"
    >
      <SectionLabel>Changes</SectionLabel>
      <p
        v-if="!run.diff"
        class="text-sm text-muted"
      >
        The agent changed no files.
      </p>
      <pre
        v-else
        class="code py-3"
      ><code><span
        v-for="(line, index) in diffLines"
        :key="index"
        class="block px-4"
        :class="{
          'bg-(--pass)/10 text-highlighted': line.tone === 'add',
          'bg-(--fail)/10 text-highlighted': line.tone === 'del',
          'text-dimmed': line.tone === 'meta' || line.tone === 'hunk',
          'text-muted': line.tone === 'ctx',
        }"
      >{{ line.text || " " }}</span></code></pre>
    </section>

    <section
      v-if="run.files.length"
      class="enter py-8"
      style="--i: 6"
    >
      <SectionLabel>Files after the run</SectionLabel>
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button
          v-for="(item, index) in run.files"
          :key="item.path"
          type="button"
          class="font-mono text-xs transition-colors"
          :class="index === selected ? 'text-highlighted underline decoration-1 underline-offset-4' : 'text-muted hover:text-highlighted'"
          :aria-pressed="index === selected"
          @click="selected = index"
        >
          {{ item.path }}
        </button>
      </div>
      <pre class="code mt-4 px-4 py-3 text-highlighted"><code>{{ file?.content }}</code></pre>
    </section>

    <section class="py-8">
      <details class="text-sm">
        <summary class="cursor-pointer text-dimmed transition-colors hover:text-highlighted">
          Raw events ({{ run.events.length }})
        </summary>
        <pre class="code mt-4 max-h-[32rem] px-4 py-3 text-muted"><code>{{ JSON.stringify(run.events, null, 2) }}</code></pre>
      </details>
    </section>
  </div>
</template>

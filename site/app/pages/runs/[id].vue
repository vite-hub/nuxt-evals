<script setup lang="ts">
import { computed, ref } from "vue"
import type { RunDetail } from "../../../shared/report"

const route = useRoute()
const { data: run, error } = await useFetch<RunDetail>(`/api/runs/${route.params.id}`)
if (error.value) throw createError({ status: error.value.statusCode ?? 500, message: error.value.message, fatal: true })

const selected = ref(0)
const file = computed(() => run.value?.files[selected.value])
const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div v-if="run" class="space-y-8">
    <section>
      <h1 class="text-xl font-semibold">{{ run.task }} #{{ run.repeat }}</h1>
      <p class="text-muted text-sm">
        {{ run.agent }} · {{ run.model }} ({{ run.reasoning }}) · setup {{ run.setup }} · {{ run.startedAt }} ·
        {{ Math.round(run.durationMs / 1000) }} s · score {{ percent(run.score) }}
      </p>
    </section>

    <section>
      <h2 class="mb-2 font-semibold">Probes</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="probe in run.probes" :key="probe.id">
          <UIcon :name="probe.passed ? 'i-lucide-check' : 'i-lucide-x'" :class="probe.passed ? 'text-success' : 'text-error'" />
          <span class="text-muted">[{{ probe.layer }}]</span> {{ probe.title }}
          <span v-if="probe.detail" class="text-muted">— {{ probe.detail }}</span>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="mb-2 font-semibold">Diagnostics</h2>
      <p class="text-sm">
        {{ run.diagnostics.toolCalls }} tool calls · {{ run.diagnostics.mcpCalls }} MCP calls ·
        {{ run.diagnostics.skillReads }} skill reads · {{ run.diagnostics.webFetches }} web fetches ·
        tokens in {{ run.usage.inputTokens ?? "?" }} / out {{ run.usage.outputTokens ?? "?" }}
      </p>
      <p v-if="run.diagnostics.error" class="text-error text-sm">{{ run.diagnostics.error }}</p>
    </section>

    <section>
      <h2 class="mb-2 font-semibold">Final answer</h2>
      <pre class="whitespace-pre-wrap rounded bg-elevated p-3 text-sm">{{ run.finalText || "(none)" }}</pre>
    </section>

    <section v-if="run.files.length">
      <h2 class="mb-2 font-semibold">Files after the run</h2>
      <div class="flex gap-4">
        <ul class="w-64 shrink-0 text-sm">
          <li v-for="(item, index) in run.files" :key="item.path">
            <button class="text-left" :class="index === selected ? 'font-semibold text-primary' : ''" @click="selected = index">{{ item.path }}</button>
          </li>
        </ul>
        <pre class="min-w-0 flex-1 overflow-auto rounded bg-elevated p-3 text-xs">{{ file?.content }}</pre>
      </div>
    </section>

    <section>
      <h2 class="mb-2 font-semibold">Diff</h2>
      <pre class="overflow-auto rounded bg-elevated p-3 text-xs">{{ run.diff || "(no changes)" }}</pre>
    </section>

    <section>
      <h2 class="mb-2 font-semibold">Transcript events ({{ run.events.length }})</h2>
      <details v-for="(item, index) in run.events" :key="index" class="text-xs">
        <summary class="cursor-pointer">{{ (item as { type?: string }).type ?? "event" }}</summary>
        <pre class="overflow-auto rounded bg-elevated p-2">{{ JSON.stringify(item, null, 2) }}</pre>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { CheckSource } from "#shared/rubric"
import { type CodeOrigin, languageOf, readSource, sourceLabel } from "../utils/rubric"

/** One place a check cites: a link to it in the Files surface, then the cited lines with a little context. */
const props = defineProps<{ source: CheckSource, origin: CodeOrigin, tone: "fail" | "pass" | "neutral" }>()

const context = 3
const cap = 40

const code = ref<string>()
const failed = ref(false)
onMounted(async () => {
  try {
    code.value = await readSource(props.origin, props.source.path)
  }
  catch {
    failed.value = true
  }
})

const slice = computed(() => {
  const total = code.value?.replace(/\n$/, "").split("\n").length ?? 0
  const first = Math.min(props.source.line, total)
  const last = Math.min(Math.max(props.source.endLine ?? first, first), total)
  const from = Math.max(1, first - context)
  const to = Math.min(total, last + context, from + cap - 1)
  return { from, to, cited: [first, last] as [number, number], hidden: last + context > to ? Math.min(total, last + context) - to : 0 }
})

function open(event: MouseEvent) {
  if (!props.origin.open || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  props.origin.open(props.source)
}
</script>

<template>
  <div class="min-w-0">
    <a
      :href="origin.href(source)"
      :target="origin.open ? undefined : '_blank'"
      :rel="origin.open ? undefined : 'noopener'"
      class="group inline-flex max-w-full items-center gap-1 font-mono text-xs text-default hover:text-highlighted"
      @click="open"
    >
      <span class="flex min-w-0 underline decoration-(--ui-border-accented) underline-offset-[0.2em] group-hover:decoration-current">
        <!-- A long path gives way from its start; the line number always shows. -->
        <span class="truncate [direction:rtl]"><bdi>{{ source.path }}</bdi></span>
        <span class="shrink-0">{{ sourceLabel(source).slice(source.path.length) }}</span>
      </span>
      <UIcon
        :name="origin.open ? 'i-lucide-arrow-right' : 'i-lucide-arrow-up-right'"
        class="size-3 shrink-0 text-dimmed group-hover:text-highlighted"
      />
    </a>
    <CodeLines
      v-if="code !== undefined"
      class="mt-1.5"
      :code="code"
      :language="languageOf(source.path)"
      :from="slice.from"
      :to="slice.to"
      :cited="slice.cited"
      :tone="tone"
      numbers
    />
    <p
      v-if="code !== undefined && slice.hidden"
      class="mt-1 text-xs text-dimmed"
    >
      {{ slice.hidden }} more {{ slice.hidden === 1 ? "line" : "lines" }} in the file
    </p>
    <p
      v-else-if="failed"
      class="mt-1 text-xs text-dimmed"
    >
      Could not load this file.
    </p>
    <p
      v-else-if="code === undefined"
      class="mt-1 text-xs text-dimmed"
      aria-live="polite"
    >
      Loading…
    </p>
  </div>
</template>

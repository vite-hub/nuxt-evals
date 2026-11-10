<script setup lang="ts">
import { computed } from "vue"
import type { CheckResult, RubricLink } from "#shared/rubric"
import { type CodeOrigin, fenceLanguage, fixParts } from "../utils/rubric"

/**
 * One check, opened, read like a nostics diagnostic: why, sources, fix, expected (the reference app's passing code) and
 * see. A part without data doesn't render.
 */
const props = defineProps<{
  result?: CheckResult
  origin?: CodeOrigin
  /** The reference app's result for the same check, when it passed. */
  expected?: CheckResult
  expectedOrigin?: CodeOrigin
  expectedLabel?: string
  see: RubricLink[]
}>()

const tone = computed(() => props.result?.outcome === "fail" ? "fail" : "neutral")
const fix = computed(() => props.result?.outcome === "fail" && props.result.fix ? fixParts(props.result.fix) : [])
const sources = computed(() => props.origin ? props.result?.sources ?? [] : [])
const expectedSources = computed(() => props.expectedOrigin ? props.expected?.sources ?? [] : [])
</script>

<template>
  <dl class="diagnostic">
    <template v-if="result?.evidence">
      <dt>why</dt>
      <dd class="text-pretty text-default">
        <InlineCode :text="result.evidence" />
      </dd>
    </template>

    <template v-if="sources.length">
      <dt>sources</dt>
      <dd class="space-y-3">
        <RubricSource
          v-for="source in sources"
          :key="`${source.path}:${source.line}`"
          :source="source"
          :origin="origin!"
          :tone="tone"
        />
      </dd>
    </template>

    <template v-if="fix.length">
      <dt>fix</dt>
      <dd class="space-y-2 text-pretty text-default">
        <template
          v-for="(part, index) in fix"
          :key="index"
        >
          <p v-if="part.type === 'text'">
            <InlineCode :text="part.text" />
          </p>
          <CodeLines
            v-else
            :code="part.code"
            :language="fenceLanguage(part.language)"
          />
        </template>
      </dd>
    </template>

    <template v-if="expected">
      <dt>expected</dt>
      <dd class="space-y-3">
        <p class="text-pretty text-default">
          <span class="text-muted">{{ expectedLabel ?? "Reference" }}:</span>
          <InlineCode
            class="ml-1"
            :text="expected.evidence"
          />
        </p>
        <RubricSource
          v-for="source in expectedSources"
          :key="`${source.path}:${source.line}`"
          :source="source"
          :origin="expectedOrigin!"
          tone="pass"
        />
      </dd>
    </template>

    <template v-if="see.length">
      <dt>see</dt>
      <dd>
        <ul class="flex flex-col gap-0.5">
          <li
            v-for="link in see"
            :key="link.url"
            class="min-w-0"
          >
            <a
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="link inline-flex max-w-full items-center gap-1"
            >
              <span class="truncate">{{ link.label }}</span>
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-3 shrink-0 text-dimmed"
              />
            </a>
          </li>
        </ul>
      </dd>
    </template>
  </dl>
</template>

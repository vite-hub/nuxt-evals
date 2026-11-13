<script setup lang="ts">
import { computed, type FunctionalComponent, type VNode } from "vue"
import { CodeBlock, CodeBlockContent, CodeBlockLine, useHighlightedCode } from "@vite-hub/ui"

/**
 * Lines `from` to `to` of `code`, highlighted as a whole so a slice of a `.vue` file still reads right. The `cited`
 * lines are tinted with `tone`.
 */
const props = withDefaults(defineProps<{
  code: string
  language: string
  from?: number
  to?: number
  cited?: [number, number]
  tone?: "fail" | "pass" | "neutral"
  numbers?: boolean
}>(), { from: 1, to: undefined, cited: undefined, tone: "neutral", numbers: false })

const highlighted = useHighlightedCode(() => props.code, () => props.language)
const lines = computed(() => highlighted.value.slice(props.from - 1, props.to ?? highlighted.value.length).map((node, index) => {
  const line = props.from + index
  return { line, node, cited: Boolean(props.cited && line >= props.cited[0] && line <= props.cited[1]) }
}))

const Line: FunctionalComponent<{ node: VNode }> = ({ node }) => node
</script>

<template>
  <CodeBlock
    size="sm"
    class="code-lines"
    :data-tone="tone"
  >
    <CodeBlockContent
      :line-numbers="numbers"
      :start-line="from"
      wrap
    >
      <CodeBlockLine
        v-for="item in lines"
        :key="item.line"
        :variant="item.cited ? 'highlighted' : 'default'"
      >
        <Line :node="item.node" />
      </CodeBlockLine>
    </CodeBlockContent>
  </CodeBlock>
</template>

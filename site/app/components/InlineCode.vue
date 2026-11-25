<script setup lang="ts">
import { computed } from "vue"

/** Text with `backtick` spans, as probe titles have them, rendered with inline code. */
const props = defineProps<{ text: string }>()
const parts = computed(() => props.text.split("`").map((value, index) => ({ value, code: index % 2 === 1 })))
</script>

<template>
  <span><template
    v-for="(part, index) in parts"
    :key="index"
  ><code
    v-if="part.code"
    class="rounded-sm bg-elevated px-1 font-mono text-[0.92em]"
  >{{ part.value }}</code><template v-else>{{ part.value }}</template></template></span>
</template>

<script setup lang="ts">
import { Markdown as ComarkMarkdown } from "@comark/vue"
import githubDark from "@shikijs/themes/github-dark"
import githubLight from "@shikijs/themes/github-light"
import shiki from "comark/plugins/shiki"
import comarkUi from "comark-ui/vue"

defineProps<{ markdown: string }>()

// Every comark-ui block the Vue renderer has. Shiki goes right before comark-code, as comark-ui asks.
// comark's Shiki takes theme objects: a theme name loads nothing and leaves the code plain.
const { plugins, components } = comarkUi({ chips: { download: false } })
plugins.splice(plugins.findIndex(plugin => plugin.name === "comark-code"), 0, shiki({ themes: { light: githubLight, dark: githubDark } }))
</script>

<template>
  <div class="run-summary">
    <ComarkMarkdown
      :plugins="plugins"
      :components="components"
    >
      {{ markdown }}
    </ComarkMarkdown>
  </div>
</template>

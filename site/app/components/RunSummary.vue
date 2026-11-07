<script setup lang="ts">
import { Markdown as ComarkMarkdown } from "@comark/vue"
import shiki from "comark/plugins/shiki"
import comarkUi from "comark-ui/vue"

defineProps<{ markdown: string }>()

// Every comark-ui block the Vue renderer has. Shiki goes right before comark-code, as comark-ui asks.
const { plugins, components } = comarkUi({ chips: { download: false } })
plugins.splice(plugins.findIndex(plugin => plugin.name === "comark-code"), 0, shiki({ themes: { light: "github-light", dark: "github-dark" } }))
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

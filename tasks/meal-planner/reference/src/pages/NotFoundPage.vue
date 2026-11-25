<script setup lang="ts">
import { useTitle } from "@vueuse/core"
import { computed } from "vue"
import NotFoundView from "../components/NotFoundView.vue"
import { useI18n } from "../i18n"

const { t } = useI18n()
useTitle(computed(() => t.value.app.title(t.value.notFound.title)))
</script>

<template>
  <NotFoundView />
</template>

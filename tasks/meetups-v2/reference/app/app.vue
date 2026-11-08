<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · Meetups` : "Meetups"),
  htmlAttrs: { lang: "en" },
})
// Pages with their own description override this one.
useSeoMeta({ description: "Find tech meetups near you, see who's going and grab a seat." })
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

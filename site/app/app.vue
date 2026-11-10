<script setup lang="ts">
import { computed } from "vue"

const route = useRoute()
// The results page fills the window like an app; reading pages keep a text column.
const bleed = computed(() => Boolean(route.meta.bleed))

useHead({
  htmlAttrs: { lang: "en" },
  link: [{ rel: "icon", href: "https://nuxt.com/icon.png" }],
})

useSeoMeta({
  title: "Nuxt agent evals",
  description: "Do the Nuxt MCP and Nuxt skills make coding agents write better Nuxt 5 code? Every run, session and file.",
})
</script>

<template>
  <UApp>
    <a
      href="#main-content"
      class="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-inverted px-4 py-2 text-sm text-inverted transition-transform focus:translate-y-0"
    >Skip to content</a>

    <div class="flex min-h-svh flex-col">
      <header class="sticky top-0 z-10 flex h-13 items-center gap-6 border-b border-default bg-default px-5 text-sm">
        <NuxtLink
          to="/"
          class="text-[15px] font-medium tracking-tight text-highlighted"
        >
          nuxt+vitehub<span class="text-muted">evals</span>
        </NuxtLink>
        <nav
          aria-label="Main navigation"
          class="ml-auto flex items-center gap-5"
        >
          <NuxtLink
            to="/"
            class="text-muted transition-colors hover:text-highlighted"
            exact-active-class="text-highlighted"
          >
            Results
          </NuxtLink>
          <NuxtLink
            to="/methodology"
            class="text-muted transition-colors hover:text-highlighted"
            active-class="text-highlighted"
          >
            Methodology
          </NuxtLink>
          <UColorModeButton
            size="xs"
            class="-mr-1.5 text-muted"
          />
        </nav>
      </header>

      <main
        id="main-content"
        class="w-full flex-1"
        :class="bleed ? '' : 'mx-auto max-w-3xl px-6'"
      >
        <NuxtPage />
      </main>

      <footer class="flex h-11 items-center justify-between border-t border-default px-5 text-xs text-dimmed">
        <p>
          Runs on <a
            href="https://vitehub.dev"
            class="transition-colors hover:text-highlighted"
          >ViteHub</a>
        </p>
        <a
          href="https://onmax.me"
          class="transition-colors hover:text-highlighted"
        >Maxi García</a>
      </footer>
    </div>
  </UApp>
</template>

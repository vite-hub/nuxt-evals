<script setup lang="ts">
import { computed } from "vue"

const route = useRoute()
// Pages with panes, such as /workspaces, set definePageMeta({ wide: true }).
const width = computed(() => route.meta.wide ? "max-w-6xl" : "max-w-3xl")

useHead({
  htmlAttrs: { lang: "en" },
  link: [{ rel: "icon", href: "https://nuxt.com/icon.png" }],
})

useSeoMeta({
  title: "Nuxt agent evals",
  description: "Do the Nuxt MCP and Nuxt skills make coding agents write better Nuxt 5 code? Every run, transcript and diff.",
})
</script>

<template>
  <UApp>
    <a
      href="#main-content"
      class="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-inverted px-4 py-2 text-sm text-inverted transition-transform focus:translate-y-0"
    >Skip to content</a>

    <div class="flex min-h-svh flex-col">
      <header
        class="mx-auto flex h-20 w-full items-center justify-between px-6 text-sm"
        :class="width"
      >
        <NuxtLink
          to="/"
          class="font-medium text-highlighted"
        >
          Nuxt agent evals
        </NuxtLink>
        <nav
          aria-label="Main navigation"
          class="flex items-center gap-5"
        >
          <NuxtLink
            to="/"
            class="text-muted transition-colors hover:text-highlighted"
            exact-active-class="text-highlighted"
          >
            Runs
          </NuxtLink>
          <NuxtLink
            to="/workspaces"
            class="text-muted transition-colors hover:text-highlighted"
            active-class="text-highlighted"
          >
            Workspaces
          </NuxtLink>
          <a
            href="/_vitehub"
            class="text-muted transition-colors hover:text-highlighted"
          >Console</a>
          <UColorModeButton
            size="xs"
            class="-mr-1.5 text-muted"
          />
        </nav>
      </header>

      <main
        id="main-content"
        class="mx-auto w-full flex-1 px-6"
        :class="width"
      >
        <NuxtPage />
      </main>

      <footer
        class="mx-auto mt-16 flex w-full flex-col gap-3 border-t border-default px-6 py-8 text-sm text-dimmed sm:flex-row sm:justify-between"
        :class="width"
      >
        <p>Run on <a
          href="https://vitehub.dev"
          class="transition-colors hover:text-highlighted"
        >ViteHub</a></p>
        <a
          href="https://onmax.me"
          class="transition-colors hover:text-highlighted"
        >Maxi García</a>
      </footer>
    </div>
  </UApp>
</template>

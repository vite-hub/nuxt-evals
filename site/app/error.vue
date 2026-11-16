<!-- Every error page, graded like a run: a page that isn't there scores 0 on one failed check, and a server error is the
judge crashing, which leaves the check unverified rather than failed. -->
<script setup lang="ts">
import { computed } from "vue"
import type { NuxtError } from "#app"

const props = defineProps<{ error: NuxtError }>()

const route = useRoute()
const status = computed(() => props.error.status ?? 500)
const path = computed(() => route.fullPath)

type Page = { score: number | null, title: string, lead: string, check: { id: string, outcome: "fail" | "unverified", text: string, evidence: string } }

const page = computed<Page>(() => {
  if (status.value === 404) {
    return {
      score: 0,
      title: "This page scored 0",
      lead: "An agent swore this route exists. The judge opened it and found nothing: no page, no file, not even a stub with a TODO.",
      check: { id: "P1", outcome: "fail", text: "The page the link points to exists.", evidence: `GET ${path.value} answered 404.` },
    }
  }
  if (status.value === 401 || status.value === 403) {
    return {
      score: null,
      title: "Graders only",
      lead: "This part of the site is for signed-in reviewers. Sign in and the judge will let you through.",
      check: { id: "A1", outcome: "fail", text: "The visitor may open this page.", evidence: `GET ${path.value} answered ${status.value}.` },
    }
  }
  return {
    score: null,
    title: "The judge crashed",
    lead: "Something broke on our side while building this page. That doesn't count against you: a check the judge can't run is unverified, not failed. Try again in a moment.",
    check: { id: "C1", outcome: "unverified", text: "The page loads.", evidence: `GET ${path.value} answered ${status.value}${props.error.statusText ? ` (${props.error.statusText})` : ""}.` },
  }
})

// Leaving an error page goes through clearError, which drops the error before it navigates.
const home = () => clearError({ redirect: "/" })
const retry = () => clearError({ redirect: route.fullPath })

useHead({ htmlAttrs: { lang: "en" }, link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }] })
useSeoMeta({ title: () => `${page.value.title} · Nuxt agent evals` })
</script>

<template>
  <UApp>
    <div class="flex min-h-svh flex-col">
      <header class="flex h-13 items-center border-b border-default px-5 text-sm">
        <button
          type="button"
          class="flex items-center gap-2 text-[15px] font-medium tracking-tight text-highlighted"
          @click="home"
        >
          <LogoMark class="size-4 shrink-0 text-highlighted" />
          <span>nuxt+vitehub<span class="text-muted">evals</span></span>
        </button>
      </header>

      <main
        id="main-content"
        class="mx-auto w-full max-w-xl flex-1 px-6 py-20 sm:py-28"
      >
        <p class="text-[13px] tabular-nums text-muted">
          Error {{ status }}
        </p>
        <div class="mt-3 flex items-center gap-4">
          <ScoreCell
            :score="page.score"
            size="md"
            :label="page.score === null ? 'No score' : 'Score'"
            class="h-11! min-w-14! text-lg!"
          />
          <h1 class="text-2xl font-medium text-balance text-highlighted">
            {{ page.title }}
          </h1>
        </div>
        <p class="mt-5 text-[15px] leading-7 text-pretty text-muted">
          {{ page.lead }}
        </p>

        <section
          aria-label="The check behind this page"
          class="mt-8 rounded-md border border-default px-4 py-3.5"
        >
          <div class="flex items-baseline gap-3 text-sm">
            <span class="font-mono text-xs text-dimmed">{{ page.check.id }}</span>
            <span class="text-highlighted">{{ page.check.text }}</span>
            <span
              class="ml-auto shrink-0 rounded-sm px-1.5 text-[11px] leading-5"
              :class="page.check.outcome === 'fail' ? 'bg-(--score-1)/20 text-error' : 'bg-elevated text-muted'"
            >{{ page.check.outcome }}</span>
          </div>
          <p class="mt-1.5 pl-8 font-mono text-xs break-all text-muted">
            {{ page.check.evidence }}
          </p>
        </section>

        <div class="mt-8 flex flex-wrap items-center gap-2">
          <UButton
            v-if="status === 401 || status === 403"
            @click="clearError({ redirect: `/sign-in?redirect=${encodeURIComponent(path)}` })"
          >
            Sign in
          </UButton>
          <UButton
            v-else-if="status !== 404"
            @click="retry"
          >
            Try again
          </UButton>
          <UButton
            :color="status === 404 ? 'primary' : 'neutral'"
            :variant="status === 404 ? 'solid' : 'ghost'"
            @click="home"
          >
            Back to the results
          </UButton>
          <UButton
            color="neutral"
            variant="link"
            class="text-muted"
            @click="clearError({ redirect: '/methodology' })"
          >
            How the judge grades
          </UButton>
        </div>
      </main>
    </div>
  </UApp>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const query = computed(() => ({
  q: typeof route.query.q === "string" ? route.query.q : undefined,
  city: typeof route.query.city === "string" ? route.query.city : undefined,
  page: typeof route.query.page === "string" ? route.query.page : undefined,
}))

// Back from an event page: reuse the list already in the payload instead of asking the server again.
const { data } = await useFetch("/api/events", {
  query,
  getCachedData: (key, nuxtApp, context) => context.cause === "refresh:manual" ? undefined : nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
})

function setQuery(patch: Partial<Record<"q" | "city" | "page", string | undefined>>) {
  return router.push({ query: { ...query.value, page: undefined, ...patch } })
}

// Results follow the search box as the visitor types. One request after a pause, not one per key press.
const search = ref(query.value.q ?? "")
watch(() => query.value.q, (q) => { search.value = q ?? "" })
watchDebounced(search, (q) => {
  if ((q || undefined) !== query.value.q) setQuery({ q: q || undefined })
}, { debounce: 300 })

const city = computed({
  get: () => query.value.city ?? "all",
  set: value => setQuery({ city: value === "all" ? undefined : value }),
})

const page = computed({
  get: () => Number(query.value.page ?? 1),
  set: value => setQuery({ page: value > 1 ? String(value) : undefined }),
})

const cityItems = computed(() => [{ label: "All cities", value: "all" }, ...(data.value?.cities ?? []).map(name => ({ label: name, value: name }))])

useSeoMeta({ title: "Upcoming events" })
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">
      Upcoming events
    </h1>

    <form class="flex flex-wrap gap-2" @submit.prevent="setQuery({ q: search || undefined })">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Search by title" aria-label="Search by title" class="w-64" />
      <USelect v-model="city" :items="cityItems" aria-label="City" class="w-44" />
      <UButton type="submit" label="Search" color="neutral" variant="outline" />
    </form>

    <p v-if="!data?.events.length" class="text-muted">
      No events match.
    </p>
    <ul v-else class="divide-y divide-default">
      <li v-for="event in data.events" :key="event.slug" class="flex flex-wrap items-baseline justify-between gap-2 py-3">
        <div>
          <NuxtLink :to="`/events/${event.slug}`" class="font-medium hover:underline">
            {{ event.title }}
          </NuxtLink>
          <p class="text-sm text-muted">
            {{ event.city }} · <EventStart :datetime="event.startsAt" />
          </p>
        </div>
        <span class="text-sm">{{ event.seatsLeft }} seats left</span>
      </li>
    </ul>

    <UPagination v-if="data && data.total > data.pageSize" v-model:page="page" :total="data.total" :items-per-page="data.pageSize" />
  </div>
</template>

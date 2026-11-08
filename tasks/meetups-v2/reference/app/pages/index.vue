<script setup lang="ts">
import { eventsQuerySchema } from "#shared/schemas/event"

const route = useRoute()
const router = useRouter()

// The URL is the state: a filtered page can be shared, reloaded and navigated with Back.
// The API validates the same query with the same schema.
const query = computed(() => eventsQuerySchema.parse(route.query))

const { data: cities } = await useFetch("/api/cities", { default: () => [] })
const { data, status } = await useFetch("/api/events", { query })

function setQuery(patch: Partial<Record<"q" | "city" | "page", string | number | undefined>>) {
  return router.replace({ query: { ...route.query, page: undefined, ...patch } })
}

// Typing updates the box at once and the URL (and the request) once the visitor pauses.
const search = ref(query.value.q ?? "")
watchDebounced(search, q => setQuery({ q: q.trim() || undefined }), { debounce: 300 })
watch(() => query.value.q, (q) => { search.value = q ?? "" })

const city = computed({
  get: () => query.value.city ?? "all",
  set: value => setQuery({ city: value === "all" ? undefined : value }),
})
const cityItems = computed(() => [{ label: "All cities", value: "all" }, ...cities.value.map(c => ({ label: c, value: c }))])

useSeoMeta({
  title: "Upcoming tech meetups",
  description: "Find tech meetups near you, see who's going and grab a seat.",
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">
        Upcoming meetups
      </h1>
      <p class="text-muted">
        {{ data?.total ?? 0 }} events
      </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <UInput
        v-model="search"
        type="search"
        icon="i-lucide-search"
        placeholder="Search by title, venue or city"
        aria-label="Search events"
        class="flex-1"
        :loading="status === 'pending'"
      />
      <USelect v-model="city" :items="cityItems" aria-label="City" class="sm:w-56" />
    </div>

    <UEmpty
      v-if="data && !data.items.length"
      icon="i-lucide-calendar-x"
      title="No events match"
      description="Try another search or city."
    />

    <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="event in data?.items" :key="event.slug">
        <EventCard :event="event" />
      </li>
    </ul>

    <UPagination
      v-if="data && data.total > data.pageSize"
      :page="data.page"
      :total="data.total"
      :items-per-page="data.pageSize"
      :to="page => ({ query: { ...route.query, page: page > 1 ? page : undefined } })"
      class="self-center"
    />
  </div>
</template>

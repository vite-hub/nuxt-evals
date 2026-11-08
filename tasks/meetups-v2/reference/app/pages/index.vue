<script setup lang="ts">
import { eventsQuerySchema } from "#shared/schemas/event"

const route = useRoute()
const router = useRouter()

// The URL is the state: a filtered page can be shared, reloaded and navigated with Back.
// The API validates the same query with the same schema.
const query = computed(() => eventsQuerySchema.parse(route.query))

const { data: cities } = await useFetch("/api/cities", { default: () => [] })
const { data, status, error } = await useFetch("/api/events", { query })

function setQuery(patch: Partial<Record<"q" | "city", string | undefined>>) {
  return router.push({ query: { ...route.query, page: undefined, ...patch } })
}

// Typing updates the box at once, and the URL (and the request) once the visitor pauses.
const search = ref(query.value.q ?? "")
watchDebounced(search, (value) => {
  const q = value.trim() || undefined
  // Back sets the box from the URL; don't push that same value again (it would drop the page and the forward entry).
  if (q !== query.value.q) setQuery({ q })
}, { debounce: 300 })
// Back and Forward change the URL; keep the box in step with it.
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
      <p v-if="data" class="text-muted">
        {{ data.total }} events
      </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <UFormField label="Search" class="flex-1">
        <UInput
          v-model="search"
          type="search"
          icon="i-lucide-search"
          placeholder="Title, venue or city"
          class="w-full"
          :loading="status === 'pending'"
        />
      </UFormField>
      <UFormField label="City" class="sm:w-56">
        <USelect v-model="city" :items="cityItems" class="w-full" />
      </UFormField>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Couldn't load events"
      description="Check your connection and try again."
      :actions="[{ label: 'Try again', onClick: () => refreshNuxtData() }]"
    />

    <UEmpty
      v-else-if="data && !data.items.length"
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

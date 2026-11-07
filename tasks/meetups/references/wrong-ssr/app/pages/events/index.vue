<script setup lang="ts">
interface ListItem { slug: string, title: string, city: string, startsAt: string, seatsLeft: number }

const route = useRoute()
const router = useRouter()
const data = ref<{ cities: string[], total: number, pageSize: number, events: ListItem[] }>()

async function load() {
  data.value = await $fetch("/api/events", { query: route.query })
}

onMounted(load)
watch(() => route.query, load)

const search = ref(String(route.query.q ?? ""))
const city = computed({
  get: () => String(route.query.city ?? "all"),
  set: value => router.push({ query: { ...route.query, city: value === "all" ? undefined : value, page: undefined } }),
})
const page = computed({
  get: () => Number(route.query.page ?? 1),
  set: value => router.push({ query: { ...route.query, page: value > 1 ? String(value) : undefined } }),
})
const cityItems = computed(() => [{ label: "All cities", value: "all" }, ...(data.value?.cities ?? []).map(name => ({ label: name, value: name }))])
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">
      Upcoming events
    </h1>
    <form class="flex gap-2" @submit.prevent="router.push({ query: { ...route.query, q: search || undefined, page: undefined } })">
      <UInput v-model="search" placeholder="Search by title" aria-label="Search by title" />
      <USelect v-model="city" :items="cityItems" aria-label="City" class="w-44" />
      <UButton type="submit" label="Search" />
    </form>
    <p v-if="!data">
      Loading…
    </p>
    <ul v-else class="divide-y divide-default">
      <li v-for="event in data.events" :key="event.slug" class="py-3">
        <NuxtLink :to="`/events/${event.slug}`" class="font-medium">
          {{ event.title }}
        </NuxtLink>
        <p class="text-sm text-muted">
          {{ event.city }} · <EventStart :datetime="event.startsAt" /> · {{ event.seatsLeft }} seats left
        </p>
      </li>
    </ul>
    <UPagination v-if="data" v-model:page="page" :total="data.total" :items-per-page="20" />
  </div>
</template>

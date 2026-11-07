<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const cities = await $fetch("/api/cities")
const { data, refresh } = await useFetch("/api/events", { query: computed(() => route.query) })
watch(() => route.query, () => refresh(), { deep: true })

const search = ref(String(route.query.q ?? ""))
const city = ref(String(route.query.city ?? "all"))
const page = ref(Number(route.query.page ?? 1))

watch(city, value => router.push({ query: { ...route.query, city: value === "all" ? undefined : value, page: undefined } }))
watch(page, value => router.push({ query: { ...route.query, page: value > 1 ? String(value) : undefined } }))
watch(() => route.query, (query) => {
  city.value = String(query.city ?? "all")
  page.value = Number(query.page ?? 1)
})

const cityItems = computed(() => [{ label: "All cities", value: "all" }, ...cities.map(name => ({ label: name, value: name }))])
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
    <ul class="divide-y divide-default">
      <li v-for="event in data?.events" :key="event.slug" class="py-3">
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

<script setup lang="ts">
const route = useRoute("events-slug")
const { data: event, error } = await useFetch(() => `/api/events/${route.params.slug}`)
if (error.value || !event.value) {
  const status = error.value?.status ?? 404
  throw createError({ status, statusText: status === 404 ? "Event not found" : "Couldn't load the event", fatal: true })
}

const { formatPrice } = useCurrency()
const requestUrl = useRequestURL()
const { siteUrl } = useRuntimeConfig().public
const canonical = computed(() => new URL(`/events/${route.params.slug}`, siteUrl || requestUrl.origin).href)

useSeoMeta({
  title: () => event.value?.title,
  description: () => event.value?.description.slice(0, 160),
  ogTitle: () => event.value?.title,
  ogDescription: () => event.value?.description.slice(0, 160),
  ogType: "website",
  ogUrl: canonical,
  ogImage: () => event.value?.coverPath ? new URL(coverUrl(event.value.coverPath, 1200), siteUrl || requestUrl.origin).href : undefined,
})
useHead({ link: [{ rel: "canonical", href: canonical }] })
</script>

<template>
  <article v-if="event" class="grid gap-8 lg:grid-cols-[1fr_20rem]">
    <div class="flex flex-col gap-4">
      <img
        v-if="event.coverPath"
        :src="coverUrl(event.coverPath, 1200)"
        :srcset="`${coverUrl(event.coverPath, 640)} 640w, ${coverUrl(event.coverPath, 1200)} 1200w`"
        sizes="(min-width: 1024px) 720px, 100vw"
        :alt="`Cover photo of ${event.title}`"
        width="1200"
        height="600"
        fetchpriority="high"
        class="w-full aspect-[2/1] object-cover rounded-(--ui-radius)"
      >
      <p class="text-sm text-muted">
        <EventStart :starts-at="event.startsAt" />
      </p>
      <h1 class="text-3xl font-semibold">
        {{ event.title }}
      </h1>
      <p class="text-muted">
        Hosted by {{ event.organizerName }}
      </p>
      <p class="whitespace-pre-line">
        {{ event.description }}
      </p>
    </div>

    <aside>
      <UCard>
        <dl class="grid gap-3 text-sm">
          <div>
            <dt class="text-muted">
              Where
            </dt>
            <dd>{{ event.venue }}, {{ event.city }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Local time
            </dt>
            <dd>
              <NuxtTime
                :datetime="event.startsAt"
                :time-zone="event.timeZone"
                date-style="medium"
                time-style="short"
              />
              ({{ event.timeZone.replace(/_/g, " ") }})
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Price
            </dt>
            <dd>{{ formatPrice(event.priceCents) }}</dd>
          </div>
        </dl>

        <template #footer>
          <RsvpPanel :event="event" />
        </template>
      </UCard>
    </aside>
  </article>
</template>

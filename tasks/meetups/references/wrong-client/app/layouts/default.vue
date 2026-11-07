<script setup lang="ts">
const user = useCurrentUser()
const currency = useCurrency()
// Wrong: VueUse's own dark mode next to Nuxt UI's color mode. It only applies after the app boots.
const isDark = useDark()
const currencies = [
  { label: "Auto", value: "auto" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
]

async function signOut() {
  await $fetch("/api/session", { method: "DELETE" })
  user.value = null
  await navigateTo("/")
}
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-default">
      <UContainer class="flex h-14 items-center justify-between gap-4">
        <NuxtLink to="/" class="font-semibold">
          Meetups
        </NuxtLink>
        <nav class="flex items-center gap-1">
          <UButton to="/events" variant="ghost" color="neutral" label="Events" class="rounded-xs" />
          <UButton to="/dashboard" variant="ghost" color="neutral" label="Dashboard" class="rounded-xs" />
          <USelect v-model="currency" :items="currencies" aria-label="Currency" class="w-24 rounded-xs" />
          <UButton :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" :aria-label="isDark ? 'Light mode' : 'Dark mode'" variant="ghost" color="neutral" class="rounded-xs" @click="isDark = !isDark" />
          <template v-if="user">
            <span class="px-2 text-sm">{{ user.name }}</span>
            <UButton variant="ghost" color="neutral" label="Sign out" class="rounded-xs" @click="signOut" />
          </template>
          <UButton v-else to="/login" variant="ghost" color="neutral" label="Sign in" class="rounded-xs" />
        </nav>
      </UContainer>
    </header>
    <UContainer as="main" class="py-8">
      <slot />
    </UContainer>
  </div>
</template>

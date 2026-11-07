<script setup lang="ts">
const { data: user } = await useFetch("/api/me", { key: "me" })
const currency = useCurrency()
const currencies = [
  { label: "Auto", value: "auto" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
]

async function signOut() {
  await $fetch("/api/session", { method: "DELETE" })
  await refreshNuxtData("me")
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
          <UButton to="/events" variant="ghost" color="neutral" label="Events" />
          <UButton to="/dashboard" variant="ghost" color="neutral" label="Dashboard" />
          <USelect v-model="currency" :items="currencies" aria-label="Currency" class="w-24" />
          <UColorModeButton />
          <template v-if="user">
            <span class="px-2 text-sm">{{ user.name }}</span>
            <UButton variant="ghost" color="neutral" label="Sign out" @click="signOut" />
          </template>
          <UButton v-else to="/login" variant="ghost" color="neutral" label="Sign in" />
        </nav>
      </UContainer>
    </header>
    <UContainer as="main" class="py-8">
      <slot />
    </UContainer>
  </div>
</template>

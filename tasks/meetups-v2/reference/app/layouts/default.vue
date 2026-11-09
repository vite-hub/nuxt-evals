<script setup lang="ts">
const { user, signOut } = useAuth()
const toast = useToast()

async function onSignOut() {
  try {
    await signOut()
  }
  catch (error) {
    toast.add({ title: "Couldn't sign out", description: error instanceof Error ? error.message : undefined, color: "error" })
  }
}

const userMenu = computed(() => [
  [{ label: user.value?.email ?? "", type: "label" as const }],
  [
    { label: "Your events", icon: "i-lucide-layout-dashboard", to: "/dashboard" },
    { label: "New event", icon: "i-lucide-plus", to: "/events/new" },
  ],
  [{ label: "Sign out", icon: "i-lucide-log-out", onSelect: onSignOut }],
])
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="border-b border-default">
      <UContainer class="h-16 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="font-semibold text-lg flex items-center gap-2">
          <UIcon name="i-lucide-calendar-heart" class="text-primary size-6" />
          Meetups
        </NuxtLink>

        <div class="flex items-center gap-1 sm:gap-2">
          <CurrencyPicker />
          <UColorModeButton />
          <UDropdownMenu v-if="user" :items="userMenu" :content="{ align: 'end' }">
            <!-- On a phone only the icon shows, so the header fits in 390 px. -->
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-circle-user"
              :label="user.name"
              :aria-label="`Account: ${user.name}`"
              trailing-icon="i-lucide-chevron-down"
              :ui="{ label: 'hidden sm:inline', trailingIcon: 'hidden sm:inline-flex' }"
            />
          </UDropdownMenu>
          <UButton v-else to="/sign-in" label="Sign in" color="neutral" variant="outline" />
        </div>
      </UContainer>
    </header>

    <main class="flex-1 py-8">
      <UContainer>
        <slot />
      </UContainer>
    </main>
  </div>
</template>

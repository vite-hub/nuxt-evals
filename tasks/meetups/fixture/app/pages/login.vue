<script setup lang="ts">
const users = [
  { id: "ada", label: "Ada Lovelace (organizer)" },
  { id: "grace", label: "Grace Hopper (organizer)" },
  { id: "linus", label: "Linus Park (member)" },
]

async function signIn(userId: string) {
  await $fetch("/api/session", { method: "POST", body: { userId } })
  await navigateTo("/events")
}

async function signOut() {
  await $fetch("/api/session", { method: "DELETE" })
  await navigateTo("/")
}
</script>

<template>
  <div class="max-w-sm space-y-4">
    <h1 class="text-2xl font-semibold">
      Sign in
    </h1>
    <p class="text-muted">
      Demo accounts. Pick one.
    </p>
    <div class="flex flex-col gap-2">
      <UButton v-for="user in users" :key="user.id" :label="user.label" color="neutral" variant="outline" block @click="signIn(user.id)" />
    </div>
    <UButton label="Sign out" variant="link" color="neutral" @click="signOut" />
  </div>
</template>

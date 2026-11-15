<script setup lang="ts">
const { data: me } = await useAPI("/api/me")
const token = useCookie<string | null>("token")

async function signOut() {
  token.value = null
  await navigateTo("/sign-in")
}
</script>

<template>
  <header>
    <NuxtLink to="/"><strong>Notebook</strong></NuxtLink>
    <span v-if="me">{{ me.name }} · <button type="button" @click="signOut">Sign out</button></span>
  </header>
</template>

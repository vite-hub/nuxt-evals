<script setup lang="ts">
useHead({ title: "Sign in" })

const token = useCookie<string | null>("token", { maxAge: 60 * 60 * 24 * 30, sameSite: "lax" })
const email = ref("")
const password = ref("")
const failed = ref(false)

async function signIn() {
  failed.value = false
  try {
    const result = await $fetch("/api/login", { method: "POST", body: { email: email.value, password: password.value } })
    token.value = result.token
    await navigateTo("/")
  }
  catch {
    failed.value = true
  }
}
</script>

<template>
  <div>
    <h1>Sign in</h1>
    <form @submit.prevent="signIn">
      <label>Email <input v-model="email" name="email" type="email" autocomplete="username" required></label>
      <label>Password <input v-model="password" name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">Sign in</button>
      <p v-if="failed" class="error" role="alert">Wrong email or password.</p>
    </form>
  </div>
</template>

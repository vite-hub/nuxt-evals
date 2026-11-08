<script setup lang="ts">
import { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"

useSeoMeta({ title: "Sign in", robots: "noindex" })

const route = useRoute()
const { signIn } = useAuth()

const schema = z.object({
  email: z.email("Enter your email"),
  password: z.string().min(1, "Enter your password"),
})
const state = reactive({ email: "", password: "" })
const failure = ref("")

const redirectTo = computed(() => safeRedirect(route.query.redirect))

async function onSubmit(event: FormSubmitEvent<z.infer<typeof schema>>) {
  failure.value = ""
  try {
    await signIn(event.data)
    await navigateTo(redirectTo.value, { replace: true })
  }
  catch (error) {
    failure.value = error instanceof Error ? error.message : "Couldn't sign in"
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      Sign in
    </h1>
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure" />
    <UForm :schema="schema" :state="state" class="grid gap-4" @submit="onSubmit">
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password">
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UButton type="submit" label="Sign in" block loading-auto />
    </UForm>
    <p class="text-sm text-muted">
      New here?
      <NuxtLink :to="{ path: '/sign-up', query: route.query }" class="text-primary hover:underline">
        Create an account
      </NuxtLink>
    </p>
  </div>
</template>

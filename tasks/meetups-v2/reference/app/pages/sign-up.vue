<script setup lang="ts">
import { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"

useSeoMeta({ title: "Create an account", robots: "noindex" })

const route = useRoute()
const { signUp } = useAuth()

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.email("Enter your email"),
  password: z.string().min(10, "Use at least 10 characters"),
})
const state = reactive({ name: "", email: "", password: "" })
const failure = ref("")

const redirectTo = computed(() => {
  const target = typeof route.query.redirect === "string" ? route.query.redirect : "/"
  return target.startsWith("/") && !target.startsWith("//") ? target : "/"
})

async function onSubmit(event: FormSubmitEvent<z.infer<typeof schema>>) {
  failure.value = ""
  try {
    await signUp(event.data)
    await navigateTo(redirectTo.value, { replace: true })
  }
  catch (error) {
    failure.value = error instanceof Error ? error.message : "Couldn't create the account"
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      Create an account
    </h1>
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure" />
    <UForm :schema="schema" :state="state" class="grid gap-4" @submit="onSubmit">
      <UFormField label="Name" name="name">
        <UInput v-model="state.name" autocomplete="name" class="w-full" />
      </UFormField>
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" help="At least 10 characters">
        <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UButton type="submit" label="Create account" block />
    </UForm>
    <p class="text-sm text-muted">
      Have an account?
      <NuxtLink :to="{ path: '/sign-in', query: route.query }" class="text-primary hover:underline">
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>

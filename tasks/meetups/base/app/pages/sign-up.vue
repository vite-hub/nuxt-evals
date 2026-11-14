<script setup lang="ts">
import type { z } from "zod"
import { PASSWORD_MIN, signUpSchema } from "#shared/schemas/auth"
import type { FormSubmitEvent } from "@nuxt/ui"

useSeoMeta({ title: "Create an account", robots: "noindex" })

const route = useRoute()
const { signUp } = useAuth()

const state = reactive({ name: "", email: "", password: "" })
const failure = ref("")
const submitted = ref(false)

const redirectTo = computed(() => safeRedirect(route.query.redirect))

async function onSubmit(event: FormSubmitEvent<z.infer<typeof signUpSchema>>) {
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
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure" role="alert" />
    <UForm :schema="signUpSchema" :state="state" class="grid gap-4" @submit="onSubmit" :validate-on-input-delay="0" @error="submitted = true">
      <UFormField label="Name" name="name" :eager-validation="submitted">
        <UInput v-model="state.name" autocomplete="name" class="w-full" />
      </UFormField>
      <UFormField label="Email" name="email" :eager-validation="submitted">
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" :help="`At least ${PASSWORD_MIN} characters`" :eager-validation="submitted">
        <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UButton type="submit" label="Create account" block loading-auto />
    </UForm>
    <p class="text-sm text-muted">
      Have an account?
      <NuxtLink :to="{ path: '/sign-in', query: route.query }" class="text-primary hover:underline">
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>

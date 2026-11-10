<script setup lang="ts">
import type { z } from "zod"
import { signInSchema } from "#shared/schemas/auth"
import type { FormSubmitEvent } from "@nuxt/ui"

useSeoMeta({ title: "Sign in", robots: "noindex" })

const route = useRoute()
const { signIn, signInWithPasskey } = useAuth()

const state = reactive({ email: "", password: "" })
const failure = ref("")
// After a failed submit, fields revalidate as you type, so an error clears before you click again.
// Without this, Nuxt UI waits for blur, and the error vanishing on blur moves the button away mid-click.
const submitted = ref(false)

const redirectTo = computed(() => safeRedirect(route.query.redirect))

async function attempt(signInWith: () => Promise<void>) {
  failure.value = ""
  try {
    await signInWith()
    await navigateTo(redirectTo.value, { replace: true })
  }
  catch (error) {
    failure.value = error instanceof Error ? error.message : "Couldn't sign in"
  }
}

const onSubmit = (event: FormSubmitEvent<z.infer<typeof signInSchema>>) => attempt(() => signIn(event.data))
</script>

<template>
  <div class="max-w-sm mx-auto flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      Sign in
    </h1>
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure" role="alert" />
    <UForm :schema="signInSchema" :state="state" class="grid gap-4" @submit="onSubmit" :validate-on-input-delay="0" @error="submitted = true">
      <UFormField label="Email" name="email" :eager-validation="submitted">
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" :eager-validation="submitted">
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UButton type="submit" label="Sign in" block loading-auto />
    </UForm>
    <USeparator label="or" />
    <UButton
      label="Sign in with a passkey"
      icon="i-lucide-key-round"
      color="neutral"
      variant="outline"
      block
      loading-auto
      @click="attempt(signInWithPasskey)"
    />
    <p class="text-sm text-muted">
      New here?
      <NuxtLink :to="{ path: '/sign-up', query: route.query }" class="text-primary hover:underline">
        Create an account
      </NuxtLink>
    </p>
  </div>
</template>

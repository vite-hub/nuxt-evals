<script setup lang="ts">
import type { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"
import { forgotPasswordSchema } from "#shared/schemas/auth"

useSeoMeta({ title: "Reset your password", robots: "noindex" })

const state = reactive({ email: "" })
const sent = ref(false)
const failure = ref("")

async function onSubmit(event: FormSubmitEvent<z.infer<typeof forgotPasswordSchema>>) {
  failure.value = ""
  // Better Auth answers the same whether or not the address has an account, so this page can't be used to find one.
  const { error } = await authClient.requestPasswordReset({ email: event.data.email, redirectTo: "/reset-password" })
  if (error) failure.value = error.message ?? "Couldn't send the link"
  else sent.value = true
}
</script>

<template>
  <div class="max-w-sm mx-auto flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      Reset your password
    </h1>
    <UAlert
      v-if="sent"
      color="success"
      variant="subtle"
      title="Check your email"
      :description="`If ${state.email} has an account, a link to choose a new password is on its way. It works for an hour.`"
      role="status"
    />
    <template v-else>
      <UAlert v-if="failure" color="error" variant="subtle" :title="failure" role="alert" />
      <UForm :schema="forgotPasswordSchema" :state="state" class="grid gap-4" @submit="onSubmit">
        <UFormField label="Email" name="email">
          <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UButton type="submit" label="Send me a link" block loading-auto />
      </UForm>
    </template>
    <p class="text-sm text-muted">
      <NuxtLink to="/sign-in" class="text-primary hover:underline">
        Back to sign in
      </NuxtLink>
    </p>
  </div>
</template>

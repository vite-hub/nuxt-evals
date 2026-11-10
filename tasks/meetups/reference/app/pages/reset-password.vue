<script setup lang="ts">
import type { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"
import { PASSWORD_MIN, resetPasswordSchema } from "#shared/schemas/auth"

useSeoMeta({ title: "Choose a new password", robots: "noindex" })

// Better Auth's link checks the token, then lands here with ?token=…, or with ?error=INVALID_TOKEN when it expired.
const route = useRoute()
const token = computed(() => typeof route.query.token === "string" ? route.query.token : "")
const toast = useToast()
const state = reactive({ password: "" })
const failure = ref("")

async function onSubmit(event: FormSubmitEvent<z.infer<typeof resetPasswordSchema>>) {
  failure.value = ""
  const { error } = await authClient.resetPassword({ newPassword: event.data.password, token: token.value })
  if (error) {
    failure.value = error.message ?? "Couldn't change the password"
    return
  }
  toast.add({ title: "Password changed", description: "Sign in with your new password.", color: "success" })
  await navigateTo("/sign-in", { replace: true })
}
</script>

<template>
  <div class="max-w-sm mx-auto flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      Choose a new password
    </h1>
    <UAlert
      v-if="!token"
      color="error"
      variant="subtle"
      title="This link has expired or was already used"
      role="alert"
      :actions="[{ label: 'Send a new link', to: '/forgot-password' }]"
    />
    <template v-else>
      <UAlert v-if="failure" color="error" variant="subtle" :title="failure" role="alert" />
      <UForm :schema="resetPasswordSchema" :state="state" class="grid gap-4" @submit="onSubmit">
        <UFormField label="New password" name="password" :help="`At least ${PASSWORD_MIN} characters`">
          <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UButton type="submit" label="Change password" block loading-auto />
      </UForm>
    </template>
  </div>
</template>

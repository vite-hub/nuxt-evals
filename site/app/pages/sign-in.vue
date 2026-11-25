<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { authClient } from "../utils/auth-client"

useSeoMeta({ title: "Sign in · Nuxt agent evals", robots: "noindex" })

const route = useRoute()
const session = authClient.useSession()
const { data: setup, refresh: refreshSetup } = useFetch<{ open: boolean }>("/api/auth-setup", { server: false })

const redirect = computed(() => {
  const target = route.query.redirect
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/"
})

const name = ref("")
const email = ref("")
const password = ref("")
const pending = ref(false)
const error = ref("")
const passkeys = ref<number>()

async function run(action: () => Promise<{ data?: unknown, error?: { message?: string } | null } | void>) {
  pending.value = true
  error.value = ""
  try {
    const result = await action()
    if (result && result.error) error.value = result.error.message ?? "Something went wrong."
    return result
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    pending.value = false
  }
}

function follow() {
  navigateTo(redirect.value)
}

async function signUp() {
  const result = await run(() => authClient.signUp.email({ name: name.value, email: email.value, password: password.value }))
  if (!error.value) {
    await refreshSetup()
    await session.value.refetch()
    await loadPasskeys()
  }
  return result
}

async function signInWithPasskey() {
  await run(() => authClient.signIn.passkey())
  if (!error.value) follow()
}

async function signInWithPassword() {
  await run(() => authClient.signIn.email({ email: email.value, password: password.value }))
  if (!error.value) follow()
}

async function addPasskey() {
  await run(() => authClient.passkey.addPasskey({ name: "Bitwarden" }))
  await loadPasskeys()
}

async function loadPasskeys() {
  const result = await authClient.passkey.listUserPasskeys()
  passkeys.value = result.data?.length ?? 0
}

const signedIn = computed(() => Boolean(session.value.data?.user))
onMounted(() => {
  if (signedIn.value) loadPasskeys()
})
</script>

<template>
  <section class="mx-auto max-w-sm py-16">
    <h1 class="text-xl font-medium tracking-tight text-highlighted">
      {{ signedIn ? "Account" : setup?.open ? "Create the account" : "Sign in" }}
    </h1>

    <div
      v-if="session.isPending"
      class="mt-6 text-sm text-muted"
    >
      Loading…
    </div>

    <!-- Signed in on the site itself. -->
    <div
      v-else-if="signedIn"
      class="mt-6 space-y-4 text-sm"
    >
      <p class="text-muted">
        Signed in as {{ session.data?.user.email }}.
        <template v-if="passkeys !== undefined">
          {{ passkeys ? `${passkeys} passkey${passkeys === 1 ? "" : "s"}.` : "No passkey yet." }}
        </template>
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          :loading="pending"
          :variant="passkeys ? 'outline' : 'solid'"
          @click="addPasskey"
        >
          Add a passkey
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          :to="redirect"
        >
          Continue
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          @click="authClient.signOut().then(() => session.refetch())"
        >
          Sign out
        </UButton>
      </div>
    </div>

    <!-- The one account, before it exists. -->
    <form
      v-else-if="setup?.open"
      class="mt-6 space-y-3"
      @submit.prevent="signUp"
    >
      <p class="text-sm text-muted">
        This site has one account. After it exists, sign-up closes.
      </p>
      <UFormField
        label="Name"
        name="name"
      >
        <UInput
          v-model="name"
          autocomplete="name"
          class="w-full"
          required
        />
      </UFormField>
      <UFormField
        label="Email"
        name="email"
      >
        <UInput
          v-model="email"
          type="email"
          autocomplete="username"
          class="w-full"
          required
        />
      </UFormField>
      <UFormField
        label="Password"
        name="password"
      >
        <UInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="w-full"
          required
          minlength="12"
        />
      </UFormField>
      <UButton
        type="submit"
        :loading="pending"
      >
        Create account
      </UButton>
    </form>

    <!-- Signed out. -->
    <div
      v-else
      class="mt-6 space-y-6"
    >
      <UButton
        icon="i-lucide-key-round"
        :loading="pending"
        @click="signInWithPasskey"
      >
        Sign in with a passkey
      </UButton>
      <details class="text-sm">
        <summary class="cursor-pointer text-muted">
          Use the password
        </summary>
        <form
          class="mt-3 space-y-3"
          @submit.prevent="signInWithPassword"
        >
          <UFormField
            label="Email"
            name="email"
          >
            <UInput
              v-model="email"
              type="email"
              autocomplete="username webauthn"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="Password"
            name="password"
          >
            <UInput
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full"
              required
            />
          </UFormField>
          <UButton
            type="submit"
            color="neutral"
            variant="outline"
            :loading="pending"
          >
            Sign in
          </UButton>
        </form>
      </details>
    </div>

    <p
      v-if="error"
      role="alert"
      class="mt-4 text-sm text-error"
    >
      {{ error }}
    </p>
  </section>
</template>

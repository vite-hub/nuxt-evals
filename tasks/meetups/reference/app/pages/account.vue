<script setup lang="ts">
import type { Passkey } from "@better-auth/passkey"

definePageMeta({ middleware: "auth" })
useSeoMeta({ title: "Your account", robots: "noindex" })

const { user } = useAuth()
const toast = useToast()

// Better Auth's own route, so the list is in the first HTML; useFetch forwards the visitor's cookie on the server.
type PasskeyRow = Pick<Passkey, "id" | "name" | "createdAt">
const { data: passkeys, refresh, error } = await useFetch<PasskeyRow[]>("/api/auth/passkey/list-user-passkeys", {
  default: () => [],
  transform: list => list.map(({ id, name, createdAt }) => ({ id, name, createdAt })),
})

async function act(run: () => Promise<{ error: { message?: string } | null }>, done: string, failed: string) {
  const { error } = await run()
  if (error) return toast.add({ title: failed, description: error.message, color: "error" })
  toast.add({ title: done, color: "success" })
  await refresh()
}

// The browser names the device in its own prompt; the label helps tell passkeys apart here.
const addPasskey = () => act(() => authClient.passkey.addPasskey({ name: `Passkey ${passkeys.value.length + 1}` }), "Passkey added", "Couldn't add the passkey")
const removePasskey = (id: string) => act(() => authClient.passkey.deletePasskey({ id }), "Passkey removed", "Couldn't remove the passkey")
</script>

<template>
  <div class="max-w-xl flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">
        Your account
      </h1>
      <p class="text-muted">
        {{ user?.name }} · {{ user?.email }}
      </p>
    </div>

    <section class="flex flex-col gap-3" aria-labelledby="passkeys">
      <div class="flex items-center justify-between gap-4">
        <h2 id="passkeys" class="text-lg font-semibold">
          Passkeys
        </h2>
        <UButton icon="i-lucide-key-round" label="Add a passkey" loading-auto @click="addPasskey" />
      </div>
      <p class="text-sm text-muted">
        Sign in with your fingerprint, face or device PIN instead of your password.
      </p>
      <UAlert v-if="error" color="error" variant="subtle" title="Couldn't load your passkeys" role="alert" />
      <UEmpty v-else-if="!passkeys.length" icon="i-lucide-key-round" title="No passkeys yet" />
      <ul v-else class="divide-y divide-default border border-default rounded-(--ui-radius)">
        <li v-for="item in passkeys" :key="item.id" class="p-4 flex items-center justify-between gap-4">
          <div>
            <p class="font-medium">
              {{ item.name || "Passkey" }}
            </p>
            <p class="text-sm text-muted">
              Added <NuxtTime :datetime="item.createdAt" date-style="medium" />
            </p>
          </div>
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="`Remove ${item.name || 'passkey'}`"
            loading-auto
            @click="removePasskey(item.id)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
// The tempting wrong form: a hand-made overlay with a Tab trap and clickable divs.
const emit = defineEmits<{ created: [] }>()
const open = ref(false)
const name = ref("")
const visibility = ref<"private" | "public">("private")
const error = ref("")
const panel = useTemplateRef<HTMLElement>("panel")

function trap(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false
  if (event.key !== "Tab" || !panel.value) return
  const items = panel.value.querySelectorAll<HTMLElement>("input, button, [tabindex]")
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    last?.focus()
    event.preventDefault()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    first?.focus()
    event.preventDefault()
  }
}

async function create() {
  if (!name.value) return
  try {
    await $fetch("/api/projects", { method: "POST", body: { name: name.value, visibility: visibility.value } })
    open.value = false
    emit("created")
  }
  catch {
    error.value = "Something went wrong"
  }
}
</script>

<template>
  <div>
    <div class="cursor-pointer rounded bg-primary px-3 py-1 text-inverted" @click="open = true">
      New project
    </div>
    <div v-if="open" class="fixed inset-0 grid place-items-center bg-black/50" @click.self="open = false" @keydown="trap">
      <div ref="panel" class="w-96 space-y-3 rounded bg-default p-4">
        <h2 class="font-semibold">
          New project
        </h2>
        <input v-model="name" placeholder="Name" class="w-full border p-1">
        <div class="flex gap-2">
          <span :class="visibility === 'private' && 'font-bold'" @click="visibility = 'private'">Private</span>
          <span :class="visibility === 'public' && 'font-bold'" @click="visibility = 'public'">Public</span>
        </div>
        <p v-if="error">
          {{ error }}
        </p>
        <button type="button" @click="create">
          Create project
        </button>
      </div>
    </div>
  </div>
</template>

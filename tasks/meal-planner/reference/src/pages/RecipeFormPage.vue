<script setup lang="ts">
import { useEventListener, useTitle } from "@vueuse/core"
import { computed, ref, useTemplateRef, watch } from "vue"
import { onBeforeRouteLeave, useRouter } from "vue-router"
import RecipeForm from "../components/RecipeForm.vue"
import { useAppUpdate } from "../composables/app-update"
import { useRecipes } from "../composables/recipes"
import { useVersionedStorage } from "../composables/storage"
import { notify } from "../composables/toasts"
import { toDateKey } from "../domain/dates"
import { type DraftErrors, emptyDraft, parseDraft, readDraft, type RecipeDraft, toDraft } from "../domain/recipe-draft"
import { useI18n } from "../i18n"
import LoadError from "../components/LoadError.vue"
import NotFoundView from "../components/NotFoundView.vue"

// New recipe without `id`, editing with one. Only custom recipes can be edited.
const props = defineProps<{ id?: string }>()
const router = useRouter()
const { t, language } = useI18n()
const recipes = useRecipes()
const { applying } = useAppUpdate()

const existing = computed(() => props.id === undefined ? undefined : recipes.recipe(props.id))
const missing = computed(() => props.id !== undefined && recipes.status.value === "ready" && !existing.value?.custom)
const heading = computed(() => existing.value ? t.value.form.editTitle(existing.value.title) : t.value.form.newTitle)
useTitle(computed(() => t.value.app.title(missing.value ? t.value.notFound.title : heading.value)))
// Rows name catalog ingredients, so the form waits for the catalog: a row filled before it arrived would read as free text.
const ready = computed(() => recipes.catalog.value.size > 0)

/** The recipe as it was opened or last saved. The form is dirty when the draft differs from it. */
const base = ref<RecipeDraft>(emptyDraft())
const draft = ref<RecipeDraft>(base.value)
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(base.value))
const errors = ref<DraftErrors>({})
const form = useTemplateRef("form")

// Unsaved changes are kept in storage while the form is dirty, so a reload, a closed tab or an app update loses
// nothing: the form offers them back when it opens again.
// The page is reused between a new recipe and an edit, so the key follows the id.
const kept = useVersionedStorage<RecipeDraft | null>(() => `meal-planner:draft:${props.id ?? "new"}`, { version: 1, parse: parseDraft, initial: null })
// The form replaces the draft on every change, so a shallow watch sees them all.
watch(draft, value => (kept.value = dirty.value ? value : null))

// The recipe to edit arrives with the data, after the page may already be open; a kept draft wins over it. Another
// recipe (or a new one) starts the form again.
watch([() => props.id, existing, ready], ([id], previous) => {
  const switched = previous !== undefined && id !== previous[0]
  if (!ready.value || (dirty.value && !switched) || (id && !existing.value?.custom)) return
  base.value = existing.value ? toDraft(existing.value, recipes.catalog.value, language.value) : emptyDraft()
  draft.value = kept.value ?? base.value
  errors.value = {}
  if (kept.value) notify(t.value.form.draftRestored, "info", { label: t.value.form.discardDraft, run: () => (draft.value = base.value) })
}, { immediate: true })

function submit() {
  const result = readDraft(draft.value, recipes.catalog.value)
  if ("errors" in result) {
    errors.value = result.errors
    void form.value?.focusFirstError()
    return
  }
  errors.value = {}
  const recipe = {
    ...result.recipe,
    id: existing.value?.id ?? `custom-${crypto.randomUUID()}`,
    createdAt: existing.value?.createdAt ?? toDateKey(new Date()),
    custom: true as const,
  }
  recipes.saveRecipe(recipe)
  base.value = draft.value
  kept.value = null
  notify(t.value.form.saved(recipe.title))
  void router.push({ name: "recipe", params: { id: recipe.id } })
}

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  if (!window.confirm(t.value.form.leave)) return false
  kept.value = null
  return true
})
// Reloading or closing the tab: the browser asks with its own words. An update the user accepted reloads without
// asking: the draft is kept.
useEventListener(window, "beforeunload", (event: BeforeUnloadEvent) => {
  if (!dirty.value || applying.value) return
  event.preventDefault()
  // Older browsers show the prompt only when returnValue is set.
  event.returnValue = ""
})
</script>

<template>
  <NotFoundView v-if="missing" />
  <div v-else class="page form-page">
    <h1 tabindex="-1">
      {{ heading }}
    </h1>
    <LoadError v-if="!ready && recipes.status.value === 'error'" />
    <p v-else-if="!ready" class="muted" role="status">
      {{ t.app.loading }}
    </p>
    <RecipeForm v-else ref="form" v-model="draft" :errors="errors" :action="existing ? t.form.update : t.form.create" @submit="submit">
      <template #actions>
        <RouterLink class="button" :to="existing ? { name: 'recipe', params: { id: existing.id } } : { name: 'my-recipes' }">
          {{ t.form.cancel }}
        </RouterLink>
      </template>
    </RecipeForm>
  </div>
</template>

<style scoped>
.form-page {
  max-width: 56rem;
}
</style>

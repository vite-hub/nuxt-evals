<script setup lang="ts">
import { ref, useId, useTemplateRef } from "vue"
import { allergens, diets, type Person } from "../domain/types"
import { useI18n } from "../i18n"

// Adds or edits one person of the household.
const props = defineProps<{ person?: Person, action: string }>()
const emit = defineEmits<{ save: [person: Person], cancel: [] }>()
const { t } = useI18n()
const name = ref(props.person?.name ?? "")
const chosenDiets = ref([...props.person?.diets ?? []])
const chosenAllergies = ref([...props.person?.allergies ?? []])
const error = ref("")
const id = useId()
const nameInput = useTemplateRef("nameInput")

function save() {
  if (!name.value.trim()) {
    error.value = t.value.household.nameRequired
    nameInput.value?.focus()
    return
  }
  emit("save", { id: props.person?.id ?? crypto.randomUUID(), name: name.value.trim(), diets: chosenDiets.value, allergies: chosenAllergies.value })
  if (!props.person) {
    name.value = ""
    chosenDiets.value = []
    chosenAllergies.value = []
  }
  error.value = ""
}
</script>

<template>
  <form class="person-form" novalidate @submit.prevent="save">
    <div class="field">
      <label :for="`name-${id}`">{{ t.household.name }}</label>
      <input :id="`name-${id}`" ref="nameInput" v-model="name" class="input" autocomplete="off" :aria-invalid="Boolean(error)" :aria-describedby="error ? `name-error-${id}` : undefined">
      <p v-if="error" :id="`name-error-${id}`" class="error-text">
        {{ error }}
      </p>
    </div>
    <fieldset class="options">
      <legend class="legend">
        {{ t.household.diets }}
      </legend>
      <label v-for="diet in diets" :key="diet" class="option">
        <input v-model="chosenDiets" type="checkbox" :value="diet">
        {{ t.words.diets[diet] }}
      </label>
    </fieldset>
    <fieldset class="options">
      <legend class="legend">
        {{ t.household.allergies }}
      </legend>
      <label v-for="allergen in allergens" :key="allergen" class="option">
        <input v-model="chosenAllergies" type="checkbox" :value="allergen">
        {{ t.words.allergens[allergen] }}
      </label>
    </fieldset>
    <div class="toolbar">
      <button type="submit" class="button primary">
        {{ action }}
      </button>
      <button v-if="person" type="button" class="button" @click="emit('cancel')">
        {{ t.app.cancel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.person-form {
  display: grid;
  gap: 1rem;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.options .legend {
  width: 100%;
  padding: 0;
  margin-bottom: 0.25rem;
}

.option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.5rem;
}

.option input {
  width: 1.15rem;
  height: 1.15rem;
  accent-color: var(--brand-strong);
}
</style>

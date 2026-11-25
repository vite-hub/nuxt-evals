<script setup lang="ts">
import { useTitle } from "@vueuse/core"
import { computed, ref } from "vue"
import PersonForm from "../components/PersonForm.vue"
import { useHousehold } from "../composables/household"
import { notify } from "../composables/toasts"
import { focusAfterRender } from "../focus"
import type { Person } from "../domain/types"
import { useI18n } from "../i18n"

const { t, formatList } = useI18n()
useTitle(computed(() => t.value.app.title(t.value.household.title)))
const { people, save, remove } = useHousehold()
const editing = ref<string>()

const describe = (person: Person) => {
  const parts = [...person.diets.map(diet => t.value.words.diets[diet]), ...person.allergies.map(allergen => t.value.words.allergens[allergen])]
  return parts.length ? formatList(parts) : t.value.household.none
}

function saved(person: Person) {
  const known = people.value.some(item => item.id === person.id)
  save(person)
  editing.value = undefined
  notify(known ? t.value.household.saved(person.name) : t.value.household.added(person.name))
  void focusAfterRender(`[data-person="${person.id}"] button`)
}

function removePerson(person: Person) {
  const restore = remove(person.id)
  notify(t.value.household.removed(person.name), "info", { label: t.value.app.undo, run: restore })
  void focusAfterRender("#new-person input")
}
</script>

<template>
  <div class="page household">
    <h1 tabindex="-1">
      {{ t.household.title }}
    </h1>
    <p class="muted">
      {{ t.household.intro }}
    </p>
    <p v-if="!people.length" class="empty">
      {{ t.household.empty }}
    </p>
    <ul v-else class="people">
      <li v-for="person in people" :key="person.id" class="card person" :data-person="person.id">
        <PersonForm v-if="editing === person.id" :person="person" :action="t.household.save" @save="saved" @cancel="editing = undefined" />
        <template v-else>
          <div>
            <h2 class="name">
              {{ person.name }}
            </h2>
            <p class="muted">
              {{ describe(person) }}
            </p>
          </div>
          <div class="toolbar">
            <button type="button" class="button small" :aria-label="t.household.editLabel(person.name)" @click="editing = person.id">
              {{ t.household.edit }}
            </button>
            <button type="button" class="button small danger" :aria-label="t.household.removeLabel(person.name)" @click="removePerson(person)">
              {{ t.household.remove }}
            </button>
          </div>
        </template>
      </li>
    </ul>
    <section id="new-person" class="card new" aria-labelledby="new-person-title">
      <h2 id="new-person-title">
        {{ t.household.newPerson }}
      </h2>
      <PersonForm :action="t.household.add" @save="saved" />
    </section>
  </div>
</template>

<style scoped>
.household {
  max-width: 48rem;
}

.people {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0;
  padding: 0;
  list-style: none;
}

.person {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.9rem 1rem;
}

.person > form {
  flex: 1;
}

.name {
  margin: 0;
  font-size: 1.1rem;
}

.person p {
  margin: 0.2rem 0 0;
}

.new {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 1rem;
}

.new h2 {
  margin: 0;
  font-size: 1.1rem;
}
</style>

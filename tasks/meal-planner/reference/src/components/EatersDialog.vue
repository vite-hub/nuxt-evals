<script setup lang="ts">
import { ref } from "vue"
import { useHousehold } from "../composables/household"
import { eatersFrom, eatersOf } from "../domain/household"
import type { PlanEntry } from "../domain/types"
import { useI18n } from "../i18n"
import AppDialog from "./AppDialog.vue"

const props = defineProps<{ title: string, entry: PlanEntry }>()
const emit = defineEmits<{ confirm: [eaters: string[] | null], close: [] }>()
const { t } = useI18n()
const { people } = useHousehold()
const chosen = ref(eatersOf(props.entry, people.value).map(person => person.id))

function confirm(close: () => void) {
  emit("confirm", eatersFrom(chosen.value, people.value))
  close()
}
</script>

<template>
  <AppDialog v-slot="{ close }" :title="title" @close="emit('close')">
    <form class="eaters" @submit.prevent="confirm(close)">
      <fieldset class="people">
        <legend class="visually-hidden">
          {{ t.plan.eaters }}
        </legend>
        <label v-for="person in people" :key="person.id" class="person">
          <input v-model="chosen" type="checkbox" :value="person.id">
          {{ person.name }}
        </label>
      </fieldset>
      <div class="toolbar">
        <button type="submit" class="button primary">
          {{ t.dialog.save }}
        </button>
        <button type="button" class="button" @click="close">
          {{ t.app.cancel }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>

<style scoped>
.eaters {
  display: grid;
  gap: 1rem;
}

.people {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.person {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
}

.person input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--brand-strong);
}
</style>

<script setup lang="ts">
import { useTimeoutFn } from "@vueuse/core"
import { computed, ref, watch } from "vue"
import { type ListState, timeLimits } from "../domain/list-query"
import { sorts } from "../domain/recipe-index"
import { diets } from "../domain/types"
import { useI18n } from "../i18n"

const props = defineProps<{ state: ListState, cuisines: readonly string[] }>()
const emit = defineEmits<{ change: [change: Partial<ListState>] }>()
const { t, cuisineName } = useI18n()


// The search box shows what is typed right away; the URL gets it once typing pauses, so one word is one history entry.
// The timer stops with the component, so leaving the page never pushes a stale search.
const q = ref(props.state.q)
const { start: commitLater, stop: cancelCommit } = useTimeoutFn(() => emit("change", { q: q.value.trim() }), 350, { immediate: false })
// Back and Forward change the search in the URL: show it in the box, and drop a commit still waiting.
watch(() => props.state.q, (value) => {
  if (value === q.value.trim()) return
  cancelCommit()
  q.value = value
})

/** A filter for `v-model`: it reads the URL's state and asks for a change, which goes to the URL. */
function filter<K extends keyof ListState>(key: K) {
  return computed({
    get: () => props.state[key],
    set: value => emit("change", { [key]: value }),
  })
}
const cuisine = filter("cuisine")
const maxMinutes = filter("maxMinutes")
const sort = filter("sort")
const dietList = filter("diets")
</script>

<template>
  <form class="filters" role="search" @submit.prevent="cancelCommit(); emit('change', { q: q.trim() })">
    <label class="field search">
      <span>{{ t.list.search }}</span>
      <input v-model="q" class="input" type="search" :placeholder="t.list.searchPlaceholder" autocomplete="off" enterkeyhint="search" @input="commitLater()">
    </label>
    <label class="field">
      <span>{{ t.list.cuisine }}</span>
      <select v-model="cuisine" class="input">
        <option :value="null">{{ t.list.anyCuisine }}</option>
        <option v-for="item in cuisines" :key="item" :value="item">{{ cuisineName(item) }}</option>
      </select>
    </label>
    <label class="field">
      <span>{{ t.list.time }}</span>
      <select v-model="maxMinutes" class="input">
        <option :value="null">{{ t.list.anyTime }}</option>
        <option v-for="limit in timeLimits" :key="limit" :value="limit">{{ t.list.upTo(limit) }}</option>
      </select>
    </label>
    <label class="field">
      <span>{{ t.list.sort }}</span>
      <select v-model="sort" class="input">
        <option v-for="item in sorts" :key="item" :value="item">{{ t.list.sorts[item] }}</option>
      </select>
    </label>
    <fieldset class="diets">
      <legend class="legend">{{ t.list.diet }}</legend>
      <label v-for="diet in diets" :key="diet" class="diet">
        <input v-model="dietList" type="checkbox" :value="diet">
        {{ t.words.diets[diet] }}
      </label>
    </fieldset>
  </form>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.search {
  grid-column: 1 / -1;
}

.diets {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.diets .legend {
  width: 100%;
  padding: 0;
  margin-bottom: 0.25rem;
}

.diet {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  text-transform: capitalize;
}

.diet input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--brand-strong);
}
</style>

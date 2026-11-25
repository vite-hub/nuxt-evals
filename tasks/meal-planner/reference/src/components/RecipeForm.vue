<script setup lang="ts">
import { useTemplateRef, type WritableComputedRef } from "vue"
import { modelField } from "../composables/model-field"
import { useRecipes } from "../composables/recipes"
import { type DraftErrors, moved, newLine, newStep, type RecipeDraft } from "../domain/recipe-draft"
import { catalogName } from "../domain/ingredients"
import { courses, diets } from "../domain/types"
import { focusAfterRender } from "../focus"
import { useI18n } from "../i18n"
import IngredientRow from "./IngredientRow.vue"
import StepRow from "./StepRow.vue"

defineProps<{ errors: DraftErrors, action: string }>()
const emit = defineEmits<{ submit: [] }>()
const draft = defineModel<RecipeDraft>({ required: true })
const { catalog, cuisines } = useRecipes()
const form = useTemplateRef("form")
const { t, language, cuisineName } = useI18n()

const title = modelField(draft, "title")
const description = modelField(draft, "description")
const cuisine = modelField(draft, "cuisine")
const course = modelField(draft, "course")
const servings = modelField(draft, "servings")
const minutes = modelField(draft, "minutes")
const calories = modelField(draft, "calories")
const dietList = modelField(draft, "diets")

/** Adding, editing, moving and removing the rows of one list, keeping keyboard focus where the user is. */
function rowList<T extends { key: string }>(rows: WritableComputedRef<T[]>, make: () => T, name: "lines" | "steps") {
  return {
    add() {
      const row = make()
      rows.value = [...rows.value, row]
      // A new row gets focus, so typing can start right away.
      void focusAfterRender(`[data-row="${row.key}"] :is(input, textarea)`, form.value)
    },
    update(index: number, row: T) {
      rows.value = rows.value.map((item, at) => at === index ? row : item)
    },
    move(index: number, action: "up" | "down") {
      const row = rows.value[index]
      rows.value = moved(rows.value, index, action === "up" ? -1 : 1)
      // Moving the row moves its element, which drops focus: put it back on the button that was pressed.
      if (row) void focusAfterRender(`[data-row="${row.key}"] [data-action="${action}"]`, form.value)
    },
    remove(index: number) {
      const neighbour = rows.value[index + 1] ?? rows.value[index - 1]
      rows.value = rows.value.filter((_, at) => at !== index)
      // Focus goes to the next row's Remove, or to the Add button when the list is empty.
      void focusAfterRender(neighbour ? `[data-row="${neighbour.key}"] [data-action="remove"]` : `[data-add="${name}"]`, form.value)
    },
  }
}
const lines = rowList(modelField(draft, "lines"), newLine, "lines")
const steps = rowList(modelField(draft, "steps"), () => newStep(), "steps")

/** After a refused submit, the first field with an error gets focus, or the add button of a list that needs a row. */
function focusFirstError() {
  return focusAfterRender("[aria-invalid='true'], [data-invalid]", form.value)
}

defineExpose({ focusFirstError })
</script>

<template>
  <form ref="form" class="recipe-form" novalidate @submit.prevent="emit('submit')">
    <div class="field">
      <label for="field-title">{{ t.form.title }}</label>
      <input id="field-title" v-model="title" class="input" :aria-invalid="Boolean(errors.title)" :aria-describedby="errors.title ? 'title-error' : undefined">
      <p v-if="errors.title" id="title-error" class="error-text">{{ t.form.errors[errors.title] }}</p>
    </div>
    <label class="field">
      <span>{{ t.form.description }} <span class="muted">{{ t.form.optional }}</span></span>
      <textarea v-model="description" class="input" rows="2" />
    </label>
    <div class="fields">
      <label class="field">
        <span>{{ t.form.cuisine }}</span>
        <select v-model="cuisine" class="input">
          <option v-for="item in [...cuisines, 'Other']" :key="item" :value="item">{{ cuisineName(item) }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t.form.course }}</span>
        <select v-model="course" class="input">
          <option v-for="item in courses" :key="item" :value="item">{{ t.words.courses[item] }}</option>
        </select>
      </label>
      <div class="field">
        <label for="field-servings">{{ t.form.servings }}</label>
        <input id="field-servings" v-model="servings" class="input" inputmode="numeric" :aria-invalid="Boolean(errors.servings)" :aria-describedby="errors.servings ? 'servings-error' : undefined">
        <p v-if="errors.servings" id="servings-error" class="error-text">{{ t.form.errors[errors.servings] }}</p>
      </div>
      <div class="field">
        <label for="field-minutes">{{ t.form.minutes }}</label>
        <input id="field-minutes" v-model="minutes" class="input" inputmode="numeric" :aria-invalid="Boolean(errors.minutes)" :aria-describedby="errors.minutes ? 'minutes-error' : undefined">
        <p v-if="errors.minutes" id="minutes-error" class="error-text">{{ t.form.errors[errors.minutes] }}</p>
      </div>
      <div class="field">
        <label for="field-calories">{{ t.form.calories }} <span class="muted">{{ t.form.optional }}</span></label>
        <input id="field-calories" v-model="calories" class="input" inputmode="numeric" :aria-invalid="Boolean(errors.calories)" :aria-describedby="errors.calories ? 'calories-error' : undefined">
        <p v-if="errors.calories" id="calories-error" class="error-text">{{ t.form.errors[errors.calories] }}</p>
      </div>
    </div>
    <fieldset class="group checks">
      <legend class="legend">{{ t.form.diets }}</legend>
      <label v-for="diet in diets" :key="diet" class="check">
        <input v-model="dietList" type="checkbox" :value="diet">
        {{ t.words.diets[diet] }}
      </label>
    </fieldset>

    <fieldset class="group">
      <legend class="legend">{{ t.form.ingredients }}</legend>
      <p class="muted hint">
        {{ t.form.ingredientHint }}
      </p>
      <datalist id="ingredient-names">
        <option v-for="ingredient in catalog.values()" :key="ingredient.id" :value="catalogName(ingredient, language)" />
      </datalist>
      <p v-if="errors.lines" id="lines-error" class="error-text">{{ t.form.errors[errors.lines] }}</p>
      <ol class="rows">
        <IngredientRow
          v-for="(line, index) in draft.lines"
          :key="line.key"
          :model-value="line"
          :index="index"
          :last="index === draft.lines.length - 1"
          :error="errors[`lines.${line.key}`]"
          @update:model-value="lines.update(index, $event)"
          @up="lines.move(index, 'up')"
          @down="lines.move(index, 'down')"
          @remove="lines.remove(index)"
        />
      </ol>
      <button type="button" class="button" data-add="lines" :data-invalid="errors.lines ? '' : undefined" :aria-describedby="errors.lines ? 'lines-error' : undefined" @click="lines.add()">
        {{ t.form.addIngredient }}
      </button>
    </fieldset>

    <fieldset class="group">
      <legend class="legend">{{ t.form.steps }}</legend>
      <p v-if="errors.steps" id="steps-error" class="error-text">{{ t.form.errors[errors.steps] }}</p>
      <ol class="rows">
        <StepRow
          v-for="(step, index) in draft.steps"
          :key="step.key"
          :model-value="step"
          :index="index"
          :last="index === draft.steps.length - 1"
          :invalid="Boolean(errors.steps) && !step.text.trim()"
          @update:model-value="steps.update(index, $event)"
          @up="steps.move(index, 'up')"
          @down="steps.move(index, 'down')"
          @remove="steps.remove(index)"
        />
      </ol>
      <button type="button" class="button" data-add="steps" :data-invalid="errors.steps && !draft.steps.length ? '' : undefined" :aria-describedby="errors.steps ? 'steps-error' : undefined" @click="steps.add()">
        {{ t.form.addStep }}
      </button>
    </fieldset>

    <div class="toolbar">
      <button type="submit" class="button primary">
        {{ action }}
      </button>
      <slot name="actions" />
    </div>
  </form>
</template>

<style scoped>
.recipe-form {
  display: grid;
  gap: 1.25rem;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 1rem;
}

.group {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.capitalize {
  text-transform: capitalize;
}

.hint {
  margin: 0;
  font-size: 0.875rem;
}

.rows {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>

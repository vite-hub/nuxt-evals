// The recipe form works on a draft of strings, as the user types them, and turns it into a recipe only when every
// field is valid. Rows carry a `key` of their own so Vue keeps each row's inputs when rows are removed or reordered.
import { findIngredient, ingredientName } from "./ingredients.ts"
import { parseQuantity, quantityText } from "./quantity.ts"
import { isRecord, isText } from "./schema.ts"
import { type Course, courses, type Diet, diets, type Ingredient, type IngredientLine, type Language, type Recipe } from "./types.ts"
import { isUnit, type Unit } from "./units.ts"

export interface DraftLine {
  key: string
  quantity: string
  unit: Unit | ""
  ingredient: string
  note: string
}

export interface DraftStep {
  key: string
  text: string
}

export interface RecipeDraft {
  title: string
  description: string
  cuisine: string
  course: Course
  diets: Diet[]
  minutes: string
  servings: string
  calories: string
  lines: DraftLine[]
  steps: DraftStep[]
}

/** What is wrong with a field. The form says it in the user's language. */
export type DraftError = "title" | "servings" | "minutes" | "calories" | "lines" | "steps" | "name" | "amount" | "needsAmount" | "needsUnit"
/** Errors by field: `title`, `servings`, ..., and `lines.<key>` for an ingredient row. */
export type DraftErrors = Record<string, DraftError>

const newKey = () => crypto.randomUUID()
export const newLine = (): DraftLine => ({ key: newKey(), quantity: "", unit: "g", ingredient: "", note: "" })
export const newStep = (text = ""): DraftStep => ({ key: newKey(), text })

export function emptyDraft(): RecipeDraft {
  return { title: "", description: "", cuisine: "Other", course: "main", diets: [], minutes: "", servings: "4", calories: "", lines: [newLine()], steps: [newStep()] }
}

const wholeNumber = (text: string, min: number, max: number) => {
  const value = text.trim()
  return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null
}

export function toDraft(recipe: Recipe, catalog: ReadonlyMap<string, Ingredient>, language: Language): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisine,
    course: recipe.course,
    diets: [...recipe.diets],
    minutes: String(recipe.minutes),
    servings: String(recipe.servings),
    calories: recipe.caloriesPerServing === undefined ? "" : String(recipe.caloriesPerServing),
    lines: recipe.ingredients.map(line => ({
      key: newKey(),
      quantity: line.quantity === null ? "" : quantityText(line.quantity),
      unit: line.unit ?? "",
      ingredient: ingredientName(line, catalog, language),
      note: line.note ?? "",
    })),
    steps: recipe.steps.map(newStep),
  }
}

export type RecipeFields = Omit<Recipe, "id" | "createdAt" | "custom">

/** The recipe the draft describes, or the errors to show, keyed by field (`lines.<key>` for a row). */
export function readDraft(draft: RecipeDraft, catalog: ReadonlyMap<string, Ingredient>): { recipe: RecipeFields } | { errors: DraftErrors } {
  const errors: DraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = "title"
  const servings = wholeNumber(draft.servings, 1, 99)
  if (servings === null) errors.servings = "servings"
  const minutes = wholeNumber(draft.minutes, 1, 24 * 60)
  if (minutes === null) errors.minutes = "minutes"
  // Calories are optional: a recipe of the user's own may not know them.
  const calories = draft.calories.trim() ? wholeNumber(draft.calories, 0, 10_000) : undefined
  if (calories === null) errors.calories = "calories"

  const ingredients: IngredientLine[] = []
  for (const line of draft.lines) {
    const name = line.ingredient.trim()
    const quantity = parseQuantity(line.quantity)
    const unit = isUnit(line.unit) ? line.unit : null
    const error = !name
      ? "name"
      : Number.isNaN(quantity) || (quantity !== null && quantity <= 0)
        ? "amount"
        : quantity === null && unit
          ? "needsAmount"
          : quantity !== null && !unit ? "needsUnit" : null
    if (error) {
      errors[`lines.${line.key}`] = error
      continue
    }
    // Typed in either language, a catalog name finds its ingredient.
    const known = findIngredient(name, catalog)
    const note = line.note.trim() ? { note: line.note.trim() } : {}
    ingredients.push({ ...(known ? { ingredient: known.id } : { name }), quantity, unit, ...note })
  }
  if (!draft.lines.length) errors.lines = "lines"
  const steps = draft.steps.map(step => step.text.trim()).filter(Boolean)
  if (!steps.length) errors.steps = "steps"

  if (servings === null || minutes === null || calories === null || Object.keys(errors).length) return { errors }
  return {
    recipe: {
      title,
      description: draft.description.trim(),
      cuisine: draft.cuisine.trim() || "Other",
      course: draft.course,
      diets: [...draft.diets],
      minutes,
      servings,
      ...(calories === undefined ? {} : { caloriesPerServing: calories }),
      ingredients,
      steps,
    },
  }
}

/** The list with the item at `index` moved by `by` places, or the same list when it can't move. */
export function moved<T>(list: readonly T[], index: number, by: number): T[] {
  const target = index + by
  if (target < 0 || target >= list.length) return [...list]
  const next = [...list]
  next.splice(target, 0, ...next.splice(index, 1))
  return next
}


/** A draft kept in storage, checked when read back. */
export function parseDraft(value: unknown): RecipeDraft | null {
  if (!isRecord(value) || !Array.isArray(value.lines) || !Array.isArray(value.steps) || !Array.isArray(value.diets)) return null
  const { title, description, cuisine, minutes, servings, calories } = value
  const course = courses.find(item => item === value.course)
  if (!isText(title) || !isText(description) || !isText(cuisine) || !isText(minutes) || !isText(servings) || !isText(calories) || !course) return null
  const lines = value.lines.flatMap((line: unknown): DraftLine[] => {
    if (!isRecord(line) || !isText(line.key) || !isText(line.quantity) || !isText(line.ingredient) || !isText(line.note)) return []
    const unit = line.unit === "" ? "" : isUnit(line.unit) ? line.unit : null
    return unit === null ? [] : [{ key: line.key, quantity: line.quantity, unit, ingredient: line.ingredient, note: line.note }]
  })
  const steps = value.steps.flatMap((step: unknown): DraftStep[] => isRecord(step) && isText(step.key) && isText(step.text) ? [{ key: step.key, text: step.text }] : [])
  if (lines.length !== value.lines.length || steps.length !== value.steps.length) return null
  return { title, description, cuisine, course, diets: diets.filter(diet => (value.diets as unknown[]).includes(diet)), minutes, servings, calories, lines, steps }
}

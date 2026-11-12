import type { Unit } from "./units.ts"

export const languages = ["en", "es"] as const
export type Language = (typeof languages)[number]

export const courses = ["breakfast", "main", "side", "soup", "salad", "snack", "dessert"] as const
export type Course = (typeof courses)[number]

export const diets = ["vegetarian", "vegan", "gluten-free", "dairy-free"] as const
export type Diet = (typeof diets)[number]

export const meals = ["breakfast", "lunch", "dinner"] as const
export type Meal = (typeof meals)[number]

export const allergens = ["gluten", "dairy", "egg", "fish", "shellfish", "nuts", "peanuts", "soy", "sesame", "mustard"] as const
export type Allergen = (typeof allergens)[number]

export const animals = ["meat", "fish", "dairy", "egg", "honey"] as const
export type Animal = (typeof animals)[number]

export interface Ingredient {
  id: string
  /** English. */
  name: string
  names: { es: string }
  aisle: string
  animal?: Animal
  gluten?: boolean
  allergens?: Allergen[]
  /** Grams in one US cup: turns volumes into grams. */
  gramsPerCup?: number
  /** Grams in one piece, clove or can. */
  gramsPerPiece?: number
}

/**
 * One line of a recipe. Built-in recipes always name an ingredient of the catalog; a custom recipe may type its own
 * `name`. `quantity` and `unit` are both null for "to taste".
 */
export type IngredientLine = ({ ingredient: string } | { name: string }) & {
  quantity: number | null
  unit: Unit | null
  note?: string
}

export interface Recipe {
  /** Built-in recipes keep the old site's number as text (`"123"`); custom ones start with `custom-`. */
  id: string
  title: string
  description: string
  cuisine: string
  course: Course
  diets: Diet[]
  minutes: number
  servings: number
  /** Built-in recipes all have it; the user's own may not. */
  caloriesPerServing?: number
  rating?: number
  ratingCount?: number
  createdAt: string
  ingredients: IngredientLine[]
  steps: string[]
  custom?: true
}

/** Someone the user cooks for. */
export interface Person {
  id: string
  name: string
  diets: Diet[]
  allergies: Allergen[]
}

export interface PlanEntry {
  id: string
  /** A local calendar date, `YYYY-MM-DD`. */
  date: string
  meal: Meal
  recipeId: string
  /** Who eats it: null is everyone in the household. */
  eaters: string[] | null
}

export interface ShoppingState {
  /** Ticked shopping list items, per week (the Monday's date key). */
  ticked: Record<string, string[]>
}

/** What the user has at home, by ingredient id. */
export type Pantry = Record<string, { quantity: number, unit: Unit }>

export type UnitSystem = "metric" | "us"
export type ColorMode = "auto" | "light" | "dark"

export interface Settings {
  units: UnitSystem
  colorMode: ColorMode
  /** The language last chosen. Until then, the browser's. */
  language: Language | null
}

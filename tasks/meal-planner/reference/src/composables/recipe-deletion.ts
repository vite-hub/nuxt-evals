import { entriesOf } from "../domain/plan"
import { usePlan } from "./plan"
import { useRecipes } from "./recipes"

/** Deleting a recipe of the user's own takes it off the plan too, so no meal is left pointing at nothing. */
export function useRecipeDeletion() {
  const { plan, remove } = usePlan()
  const { deleteRecipe } = useRecipes()
  return {
    /** How many planned meals deleting the recipe would take off the plan. */
    plannedMeals: (recipeId: string) => entriesOf(plan.value, recipeId).length,
    deleteRecipe(recipeId: string) {
      const planned = entriesOf(plan.value, recipeId)
      if (planned.length) remove(planned.map(entry => entry.id))
      deleteRecipe(recipeId)
    },
  }
}

import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"

/**
 * Meal planner. Agents start with the recipe data only, and ref `main` holds the reference app (`evals base
 * meal-planner`), which agents never see. Each run commits its working copy to a ref named after the run.
 */
export const mealPlannerStore = createBlobDatabaseWorkspaceStore({ blob, database: () => useDatabase("default").db, workspace: "nuxt-evals/meal-planner", prefix: "meal-planner" })

export default defineWorkspace({ store: mealPlannerStore })

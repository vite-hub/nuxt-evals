import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"

/**
 * Meetups. Agents start in an empty folder, so ref `main` holds the reference app (`evals base meetups`), which
 * agents never see. Each run commits its working copy to a ref named after the run.
 */
export const meetupsStore = createBlobDatabaseWorkspaceStore({ blob, database: () => useDatabase("default").db, workspace: "nuxt-evals/meetups", prefix: "meetups" })

export default defineWorkspace({ store: meetupsStore })

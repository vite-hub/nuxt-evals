import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/default"

/**
 * Meetups. Agents start in an empty folder, so ref `main` holds the reference app (`evals base meetups`), which
 * agents never see. Each run commits its working copy to a ref named after the run.
 */
export const meetupsStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/meetups", prefix: "meetups" })

export default defineWorkspace({ store: meetupsStore })

import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/config"

/**
 * Meetups v2. Agents start in an empty folder, so ref `main` holds the reference app (`evals base meetups-v2`), which
 * agents never see. Each run commits its working copy to a ref named after the run.
 */
export const meetupsV2Store = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/meetups-v2", prefix: "meetups-v2" })

export default defineWorkspace({ store: meetupsV2Store })

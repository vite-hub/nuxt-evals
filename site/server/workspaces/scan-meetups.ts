import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"

/** scan-meetups, a hidden-bug project. Ref `main` holds the planted app every run starts from (`evals base scan-meetups`); each run commits its working copy to a ref named after the run. */
export const scanMeetupsStore = createBlobDatabaseWorkspaceStore({ blob, database: () => useDatabase("default").db, workspace: "nuxt-evals/scan-meetups", prefix: "scan-meetups" })

export default defineWorkspace({ store: scanMeetupsStore })

import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"

/** fix-session-reads, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-session-reads`); each run commits its working copy to a ref named after the run. */
export const fixSessionReadsStore = createBlobDatabaseWorkspaceStore({ blob, database: () => useDatabase("default").db, workspace: "nuxt-evals/fix-session-reads", prefix: "fix-session-reads" })

export default defineWorkspace({ store: fixSessionReadsStore })

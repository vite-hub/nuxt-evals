import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"

/** fix-cached-search, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-cached-search`); each run commits its working copy to a ref named after the run. */
export const fixCachedSearchStore = createBlobDatabaseWorkspaceStore({ blob, database: () => useDatabase("default").db, workspace: "nuxt-evals/fix-cached-search", prefix: "fix-cached-search" })

export default defineWorkspace({ store: fixCachedSearchStore })

import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"

/** fix-cache-leak, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-cache-leak`); each run commits its working copy to a ref named after the run. */
export const fixCacheLeakStore = createBlobDatabaseWorkspaceStore({ blob, database: () => useDatabase("default").db, workspace: "nuxt-evals/fix-cache-leak", prefix: "fix-cache-leak" })

export default defineWorkspace({ store: fixCacheLeakStore })

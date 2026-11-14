import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/default"

/** fix-session-reads, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-session-reads`); each run commits its working copy to a ref named after the run. */
export const fixSessionReadsStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/fix-session-reads", prefix: "fix-session-reads" })

export default defineWorkspace({ store: fixSessionReadsStore })

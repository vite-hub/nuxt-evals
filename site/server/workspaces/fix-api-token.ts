import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/default"

/** fix-api-token, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-api-token`); each run commits its working copy to a ref named after the run. */
export const fixApiTokenStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/fix-api-token", prefix: "fix-api-token" })

export default defineWorkspace({ store: fixApiTokenStore })

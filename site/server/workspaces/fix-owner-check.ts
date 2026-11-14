import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/default"

/** fix-owner-check, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-owner-check`); each run commits its working copy to a ref named after the run. */
export const fixOwnerCheckStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/fix-owner-check", prefix: "fix-owner-check" })

export default defineWorkspace({ store: fixOwnerCheckStore })

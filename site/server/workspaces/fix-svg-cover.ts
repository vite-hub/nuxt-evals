import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/default"

/** fix-svg-cover, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-svg-cover`); each run commits its working copy to a ref named after the run. */
export const fixSvgCoverStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/fix-svg-cover", prefix: "fix-svg-cover" })

export default defineWorkspace({ store: fixSvgCoverStore })

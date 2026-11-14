import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/default"

/** fix-seats-race, a fix project. Ref `main` holds the planted app every run starts from (`evals base fix-seats-race`); each run commits its working copy to a ref named after the run. */
export const fixSeatsRaceStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/fix-seats-race", prefix: "fix-seats-race" })

export default defineWorkspace({ store: fixSeatsRaceStore })

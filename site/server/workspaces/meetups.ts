import { blob } from "vite-hub/blob"
import { defineWorkspace } from "vite-hub/workspace"
import { createBlobDatabaseWorkspaceStore } from "vite-hub/workspace/blob-database"
import database from "../databases/config"

/**
 * The Meetups project. Ref `main` holds the starting app; each run commits the agent's working copy to a ref named
 * after the run, so a session links to exactly the files it produced. `POST /api/runs` writes it.
 */
export const meetupsStore = createBlobDatabaseWorkspaceStore({ blob, database, workspace: "nuxt-evals/meetups", prefix: "meetups" })

export default defineWorkspace({ store: meetupsStore })

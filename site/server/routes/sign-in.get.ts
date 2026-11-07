import { defineHandler, redirect } from "h3"

/**
 * A Cloudflare Access application protects only this path. Passing it sets the CF_Authorization cookie on the host,
 * and the Console reads that cookie (patched vite-hub, see patches/README.md), so a maintainer sees every section.
 */
export default defineHandler(() => redirect("/_vitehub", 302))

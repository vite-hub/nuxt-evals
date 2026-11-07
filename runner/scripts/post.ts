// Post every saved report in .data/runs to the site again: node --env-file=.env scripts/post.ts
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const root = ".data/runs"
const site = process.env.SITE_URL
if (!site) throw new Error("Set SITE_URL.")

for (const id of (await readdir(root)).sort()) {
  const report = await readFile(join(root, id, "report.json"), "utf8").catch(() => undefined)
  if (!report) continue
  const response = await fetch(new URL("/api/runs", site), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
    body: report,
  })
  console.log(id, response.status, response.ok ? "" : (await response.text()).slice(0, 200))
}

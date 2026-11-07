import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createError, defineHandler, readBody } from "h3"
import type { RunReport } from "../../../site/shared/report"
import { runsRoot } from "../utils/run-directory"
import { writeSummary } from "../utils/summary"
import { readPrompt } from "../utils/working-copy"

/** (Re)write the summary of a saved run: POST { id }. */
export default defineHandler(async (event) => {
  const { id } = await readBody<{ id: string }>(event)
  if (!id || !/^[\w.-]+$/.test(id)) throw createError({ status: 400, message: "Send a run id." })
  const path = join(runsRoot, id, "report.json")
  const report = JSON.parse(await readFile(path, "utf8")) as RunReport
  report.prompt ??= await readPrompt(report.task)
  report.summary = await writeSummary(report, report.prompt)
  await writeFile(path, JSON.stringify(report, null, 2))
  return { id, summary: report.summary }
})

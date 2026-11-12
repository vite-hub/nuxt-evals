import { cms } from "vite-hub/cms"
import { defineContent, optional } from "vite-hub/content"
import { documents } from "vite-hub/content/collections"
import { z } from "zod"

/**
 * One Comark summary per run, written by the runner's summarizer and published on ingest. Visitors read published
 * summaries on /runs/:id. Only the signed-in account may edit them in the Console (see server/console-authorize.ts).
 */
export default defineContent({
  extends: cms,
  collections: {
    runs: documents({
      path: "runs/*.md",
      label: { singular: "Run summary", plural: "Run summaries" },
      url: "/runs/:id",
      fields: {
        title: z.string(),
        project: z.string(),
        harness: z.string(),
        model: z.string(),
        setup: z.enum(["A", "B", "C"]),
        score: z.number(),
        status: z.enum(["passed", "failed", "error"]),
        startedAt: z.string(),
        invocation: optional(z.string()),
      },
    }),
  },
  // Every Content surface (the Console editor, Agents) needs a signed-in maintainer.
  authorize: ({ user }) => Boolean(user),
})

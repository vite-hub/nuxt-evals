import { cms } from "vite-hub/cms"
import { defineContent, optional } from "vite-hub/content"
import { documents } from "vite-hub/content/collections"
import { z } from "zod"
import { setupIds } from "../shared/report"

/**
 * One Comark summary per run, written by the runner's summarizer and published on ingest. Visitors read published
 * summaries on /runs/:id. Only a signed-in account may edit them (`authorize` below).
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
        setup: z.enum(setupIds),
        score: z.number(),
        status: z.enum(["passed", "failed", "error"]),
        startedAt: z.string(),
        invocation: optional(z.string()),
      },
    }),
  },
  // Published summaries are public, as on /runs/:id: /api/content/**, Markdown copies and the SEO routes serve everyone.
  access: "public",
  // Drafts, edits and publishing (the Console editor, Agents) need a signed-in maintainer.
  authorize: ({ user }) => Boolean(user),
})

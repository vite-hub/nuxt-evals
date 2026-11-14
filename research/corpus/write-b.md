# Writer brief: one Drop report from the corpus

Source of truth: `/home/maxi/vitehub/nuxt-evals/research/corpus/corpus-v0.md` (the merged corpus; read all of it). Background: `BRIEF.md` in the same folder (Maxi's request). The council files `council-*.md` hold extra detail if a case needs it.

Follow Drop's `report` skill exactly. Read it through the Executor MCP: `skills({ app: "drop", name: "report" })`, then its files `references/blocks.md` and `references/example.md` (pass the returned `version` and `revision`). Load the Executor tool with ToolSearch `select:mcp__executor__skills` if needed. Also read `skills({ app: "drop", name: "vitehub-drop" })` file `references/markdown.md` for the syntax Drop accepts. Do not publish; write the file only.

Drop pitfalls we know: never use `> [!NOTE]` (breaks the browser editor's publish; IMPORTANT, WARNING and CAUTION are fine); no `$$` math; write file names in backticks.

Reader: Maxi, who designs these evals and maintains ViteHub. He asked for "the ocean": every case should be findable in the report, but the top stays short and decision-first. Plain language, short sentences, no filler (apply the `unslop` skill's rules: no "crucial", "leverage", "delve", no em-dash chains, no rule-of-three padding).

Lint until clean, from the corpus folder:
`heavy --light pnpm dlx --package comark-linter --package comark-ui comark-lint <your-file>`
Skip the local render.

Reply with the file path, line count, the lint result, and the decisions you put in the callout. Under 200 words.

## Your report: Type B, hidden-bug static detection

File: `/home/maxi/vitehub/nuxt-evals/research/corpus/report-b-hidden-bugs.md`.

Covers: what the eval is (agent scans a repo without running it and writes `findings.json`; graded on severity-weighted recall, precision with decoys, explanation, severity order; clean-base DC0 run as the false-positive floor), the starter fixture (Meetups reference, 12 plants, 13 decoys, as section 7 says) with a table of plants (id, severity badge, file, Doctor-visible or not) and a table of decoys (id, what looks wrong, why it's correct), the whole plant pool of 80 (71 fix-case ids plus HB1-HB9) as a table with severity, file area and static signal, the 21 decoys, the growth path (densities 6/12/18, then "Meetups Hidden" with seeded draws), the matching rules (file and line window, judge confirms mechanism), tool and web rules (web off, Doctor and tsc allowed, recall split by Doctor-visible), real native bugs found in our own code while researching (BL4 cover.put.ts buffers before the size check, verified; Q16 idempotencyKey refused on Cloudflare at the pin so M sends no mail on Workers; HB2 site ingest token compared with `!==`), and the why-taxonomy as a short lens (which W causes are statically visible). Charts: plants per severity, plants per W cause or per family. Decisions in the callout: the open questions that concern Type B (tools in B, PRODUCT.md with intended access rules, real unplanted findings neutral vs bonus, fixing M's native bugs before it becomes the clean base). Mention that the Grok seat ran on Opus (Grok balance out) in How I checked. Title: the answer in under 70 characters.


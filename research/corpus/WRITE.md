# Writer brief: one Drop report from the corpus

Source of truth: `/home/maxi/vitehub/nuxt-evals/research/corpus/corpus-v0.md` (the merged corpus; read all of it). Background: `BRIEF.md` in the same folder (Maxi's request). The council files `council-*.md` hold extra detail if a case needs it.

Follow Drop's `report` skill exactly. Read it through the Executor MCP: `skills({ app: "drop", name: "report" })`, then its files `references/blocks.md` and `references/example.md` (pass the returned `version` and `revision`). Load the Executor tool with ToolSearch `select:mcp__executor__skills` if needed. Also read `skills({ app: "drop", name: "vitehub-drop" })` file `references/markdown.md` for the syntax Drop accepts. Do not publish; write the file only.

Drop pitfalls we know: never use `> [!NOTE]` (breaks the browser editor's publish; IMPORTANT, WARNING and CAUTION are fine); no `$$` math; write file names in backticks.

Reader: Maxi, who designs these evals and maintains ViteHub. He asked for "the ocean": every case should be findable in the report, but the top stays short and decision-first. Plain language, short sentences, no filler (apply the `unslop` skill's rules: no "crucial", "leverage", "delve", no em-dash chains, no rule-of-three padding).

Lint until clean, from the corpus folder:
`heavy --light pnpm dlx --package comark-linter --package comark-ui comark-lint <your-file>`
Skip the local render.

Reply with the file path, line count, the lint result, and the decisions you put in the callout. Under 200 words.

REPORT_PLACEHOLDER

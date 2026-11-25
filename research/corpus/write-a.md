# Writer brief: one Drop report from the corpus

Source of truth: `/home/maxi/vitehub/nuxt-evals/research/corpus/corpus-v0.md` (the merged corpus; read all of it). Background: `BRIEF.md` in the same folder (Maxi's request). The council files `council-*.md` hold extra detail if a case needs it.

Follow Drop's `report` skill exactly. Read it through the Executor MCP: `skills({ app: "drop", name: "report" })`, then its files `references/blocks.md` and `references/example.md` (pass the returned `version` and `revision`). Load the Executor tool with ToolSearch `select:mcp__executor__skills` if needed. Also read `skills({ app: "drop", name: "vitehub-drop" })` file `references/markdown.md` for the syntax Drop accepts. Do not publish; write the file only.

Drop pitfalls we know: never use `> [!NOTE]` (breaks the browser editor's publish; IMPORTANT, WARNING and CAUTION are fine); no `$$` math; write file names in backticks.

Reader: Maxi, who designs these evals and maintains ViteHub. He asked for "the ocean": every case should be findable in the report, but the top stays short and decision-first. Plain language, short sentences, no filler (apply the `unslop` skill's rules: no "crucial", "leverage", "delve", no em-dash chains, no rule-of-three padding).

Lint until clean, from the corpus folder:
`heavy --light pnpm dlx --package comark-linter --package comark-ui comark-lint <your-file>`
Skip the local render.

Reply with the file path, line count, the lint result, and the decisions you put in the callout. Under 200 words.

## Your report: Type A, known-issue fix evals

File: `/home/maxi/vitehub/nuxt-evals/research/corpus/report-a-fix-evals.md`.

Covers: what the eval is (a fixture with one planted bug, perf issue, security hole or legacy code; a vague user report; no skills; hidden tests as the gate; the fix matched against ranked solutions), the why-taxonomy W1-W12 as the lens on why these bugs appear, scoring A and solution matching, fixtures (M, M+, M-cf, L, J, EL, DR, ST, V) and admission/leak controls, the first 20 with an order to build them (fixture L and J block some), and the full case list of every Type A or both case (all families, including CH change tasks and MG migrations) as one table (id, title, class badge, primitive, fixture, evidence real/synthetic), grouped by family under headings or in one table. Give every one of the first 20 an accordion item with its report text, root cause, the ranked solutions (as a small table: rank badge, fix, why), the main trap, verification, and evidence. Other cases stay table rows; the corpus file holds their detail (say so once). Use a chart for counts per family split real vs synthetic, and one for cases per W cause. Include the "Vue portal" match (AU1, #4054/#4044) since Maxi asked. Decisions in the callout: the open questions from section 8 that concern Type A (pin, fixing M's native bugs, web access, Cloudflare checks, change tasks, novel fixes, contracts), as a decision table if more than three. Mention that the Grok seat ran on Opus (Grok balance out) in How I checked. Title: the answer in under 70 characters.


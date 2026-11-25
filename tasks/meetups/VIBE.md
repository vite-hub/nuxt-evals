# Vibe

A second judge pass, separate from the rubric: how the code is designed, the things a linter can't see. It scores 0 to 10 with one decimal and is shown on its own. It is not part of the headline score.

The question is the one a senior Nuxt and ViteHub reviewer asks after the app already works: would I merge this as it is, or would I ask for it to be restructured first? Look at:

- **Missing abstractions.** The same lookup, check or formatting written out in several routes or components instead of one helper; a page that owns fetching, state, validation and layout in one 400-line file.
- **Superfluous abstractions.** A composable, wrapper, class or util that only renames a framework call; a store for state one component uses; layers that pass values through without doing anything; a `useX()` for every small interaction.
- **Reinvented wheels.** Hand-written versions of what Nuxt, Nitro, h3, VueUse, Nuxt UI, Better Auth or ViteHub already give: a custom fetch client, a session system, a rate-limit counter, a cookie parser, a debounce, a date formatter, a form validation layer beside the schema library, a mail retry loop beside the queue.
- **Wrong layer.** Business rules in components, SQL in pages, auth checks spread across handlers instead of one place, client code that knows server internals.
- **Elegance.** Code that says what it means in few moving parts: one source of truth, data that flows one way, names that tell what things are, comments that say why.

The reference app (in the folder the grader names) is one good answer to the same prompt. Compare with it to calibrate, but don't mark down a different shape that is as good. Never score features, bugs or security here: the rubric does that. Only design.

## Anchors

| Score | Means | For example |
| --- | --- | --- |
| 10 | A maintainer of the framework could have written it. Every abstraction earns its place, nothing is reinvented, and a reviewer has nothing structural to ask. | Thin route files over a few named server utils; one schema shared by form and API; ViteHub and Better Auth used through their own helpers; components that each do one job. |
| 8 | Clean and idiomatic. A reviewer suggests a few local changes but no restructuring. | One composable doing two jobs; a helper that could be inlined; a 200-line page that could lose a section to a component. |
| 6 | It works and mostly reads well, but a reviewer would ask for at least one restructure before merging. | The same ownership check copied into five routes; a 400-line page; a wrapper around `$fetch` that adds nothing; a hand-written debounce beside VueUse. |
| 4 | Several structural problems a reviewer would block on. | A custom session store beside Better Auth; an in-memory rate limiter beside ViteHub Rate Limit; state kept in a store and in components; SQL in API routes and in pages' server code alike. |
| 2 | Hard to change safely. | Logic tangled across layers; copy-pasted handlers; files that mix UI, data access and server concerns; many layers that do nothing, or none where they're needed. |
| 0 | No coherent structure, or no app to read. | A single file holding everything, or an empty folder. |

Scores between anchors are fine (7.5 when it sits between 6 and 8).

## Evidence

Every finding cites the app's code as `path:line` or `path:line-line`, and says what a reviewer would ask for instead. Name what is elegant too, with its place. A score without cited findings is not accepted.

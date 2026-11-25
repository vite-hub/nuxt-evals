# Vibe

A second judge pass, separate from the rubric: how the code is designed, the things a linter can't see. It scores 0 to 10 with one decimal and is shown on its own. It is not part of the headline score.

The question is the one a senior Vue reviewer asks after the app already works: would I merge this as it is, or would I ask for it to be restructured first? Look at:

- **Missing abstractions.** The same conversion, date math, storage handling or formatting written out in several components instead of one module; a page that owns loading, filtering, state, persistence and layout in one 400-line file.
- **Superfluous abstractions.** A composable, wrapper, class or util that only renames a Vue or VueUse call; a "store" for state one component uses; layers that pass values through without doing anything; a `useX()` for every small interaction; an event bus where props and events would do.
- **Reinvented wheels.** Hand-written versions of what Vue, Vue Router, VueUse or the platform already give: a storage sync layer beside `useStorage`, a router of its own, a debounce, a color-mode switcher, a date library's worth of helpers where `Intl` does it, a deep-clone where `structuredClone` exists.
- **Wrong layer.** Unit math, shopping-list sums or date keys inside templates and components; components that read and write storage directly; routing decisions spread across pages instead of the router.
- **Elegance.** Code that says what it means in few moving parts: one source of truth, data that flows one way, derived state as `computed`, names that tell what things are, comments that say why.

The reference app (in the folder the grader names) is one good answer to the same prompt. Compare with it to calibrate, but don't mark down a different shape that is as good. Never score features, bugs or security here: the rubric does that. Only design.

## Anchors

| Score | Means | For example |
| --- | --- | --- |
| 10 | A maintainer of Vue could have written it. Every abstraction earns its place, nothing is reinvented, and a reviewer has nothing structural to ask. | Pure TypeScript modules for units, amounts, dates and search, tested on their own; a few composables that own the shared state; thin pages over small components; VueUse where it fits. |
| 8 | Clean and idiomatic. A reviewer suggests a few local changes but no restructuring. | One composable doing two jobs; a helper that could be inlined; a 200-line page that could lose a section to a component. |
| 6 | It works and mostly reads well, but a reviewer would ask for at least one restructure before merging. | Unit conversion copied into the recipe page and the shopping list; a 400-line planner page; a wrapper around `localStorage` beside `useStorage`; a hand-written debounce beside VueUse. |
| 4 | Several structural problems a reviewer would block on. | State kept in a module object and in components and synced with watchers; storage read and written from many components; date keys built three different ways. |
| 2 | Hard to change safely. | Logic tangled across components; copy-pasted handlers; files that mix data loading, persistence, domain math and UI; many layers that do nothing, or none where they're needed. |
| 0 | No coherent structure, or no app to read. | A single file holding everything, or an empty folder. |

Scores between anchors are fine (7.5 when it sits between 6 and 8).

## Evidence

Every finding cites the app's code as `path:line` or `path:line-line`, and says what a reviewer would ask for instead. Name what is elegant too, with its place. A score without cited findings is not accepted.

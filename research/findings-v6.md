# Findings v6: Meal planner, a Vue-only project

Round of 2026-11-12. Maxi asked for a second, view-only project: a hard app built with Vue 3, Vue Router 5 and official Vue packages only (no Pinia), with a reference app that scores 10, and one Opus 5.5 run to calibrate. Goal: frontier models around 5 out of 10, so there is room for the next models.

## The project

`tasks/meal-planner`: no backend, the agent starts with only `data/` (seeded by `data.mjs`). The judge serves the build with the preview command the app documents. The rubric has no ViteHub sections, so the headline is 87% rubric and 13% Vite Doctor.

## v1 was too easy

v1 asked for a planner over 2,376 recipes (search with accent folding, filters in the URL, scaling, units and fractions, a week planner with drag, keyboard and undo, a shopping list, custom recipes, sync between tabs, export and import, old hash links). The rubric had 109 checks in 17 sections.

| App | Rubric | Doctor | Vibe |
| --- | --- | --- | --- |
| Reference (blind) | 10 | 10 | 8.6 |
| Opus 5.5 medium, 28 min, $6.44 | **9.0** | 7.1 | 7.6 |

Opus wrote 82 unit and component tests, 21 Playwright tests and an axe scan, and failed only 10 checks: scroll restore after "Show more", `router.onError`, focus on a failed submit, URL cleanup, the leave prompt and dead code. Run folder: `cli/.data/archive/meal-planner-v1/`.

## v2: harder in ways a real app is hard

- **Scale:** 20,289 recipes (19.6 MB), on a 4× throttled CPU. No main-thread task over 300 ms while the list loads, none over 100 ms while typing, and the heap under 150 MB.
- **Households:** people with diets and allergies, who eats each meal, amounts by eaters, and warnings that name the person and the ingredient.
- **Pantry:** densities and piece weights to add grams, cups and pieces, and a pantry with amounts that the list subtracts.
- **Sharing:** a read-only link to a week, with custom recipes inside, merge or replace, and garbled links handled.
- **Languages:** English and Spanish in the URL, all UI strings, `Intl` plurals, numbers, dates and collation.
- **Offline and updates:** a service worker; a new version is announced and never loses a half-filled form.
- **User flows:** a judge section that plays first-time-user jobs, counting actions, dead ends and missing feedback.
- **Other:** touch planning on a phone, and experimental features explicitly allowed. Agent time limit: 120 min.

The rubric has 150 checks in 23 sections. The judge runs 7 grading sessions plus the vibe pass.

| App | Rubric | Doctor | Vibe |
| --- | --- | --- | --- |
| Reference (blind) | 10 | 10 | 8.8 |
| Opus 5.5 medium, 53 min, $14.85 | **8.2** | 6.0 | 7.6 |

Opus built every v2 feature on its own: a build-time data plugin, a search worker, a hand-written service worker, compressed share links and diet checks. It failed 25 of 150 checks. The lowest sections were Languages 5.4, Forms 6.4, Accessibility 6.7, Offline 7.1 and Sharing 7.5. The fails are real; spot-checked in its code:
- `cilbir` doesn't find Çılbır (no `ı` in its folding table).
- Updates are checked only when the tab becomes visible again.
- `1 cups`.
- No size limit on import.
- No reorder for ingredient rows.

## What this says

Opus 5.5 knows Vue, the router, VueUse and the platform well. A longer feature list moves it about one point per doubling of scope. Meetups lands at 3.8 because of ViteHub, a library the models don't know yet, and production-server details; Vue alone doesn't produce that gap. Ways to reach 5 without tricks, for Maxi to choose:

1. **Stricter section scoring:** a section caps at 5 while any major check fails. This is how a reviewer reads a feature that doesn't work.
2. **More runs before pruning:** run Fable, Sol and Luna. Prune checks every model passes (Meetups pruned 38), and weigh the sections where models differ.
3. **Score efficiency apart:** show time and cost next to quality, or as a separate score, not inside it.

## Harness changes

- **Per-project judge:** each rubric project has a `judge` config (`tasks/<project>/task.ts`): groups, setup checks, build and serve steps, stack rules and the APIs a fix names. `tasks/rubric.ts` reads any project's RUBRIC.md, `tasks/index.ts` lists the projects, and a task can set `timeLimitMinutes`.
- **Whole files:** `readWorkingCopy` cut every text file at 200,000 characters. It broke the judge's copy of recipes.json and failed 30 reference checks. Files are now whole, up to 32 MB.
- **Saved files:** `dist/` stays out of a run's files, and symlinks are followed: the reference's `data/` links to the fixture's.
- **Site:**
  - a Meal planner Workspace, and a task switch on the results page (`?task=`);
  - per-project section names and stack label;
  - the Preview gives a Vite app's dev script the preview port.
- **Push:** rubric projects send no starting files, so a fixture can't replace the reference at the head of `main`.

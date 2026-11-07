# Findings from v4: a harder Meetups, setups B and C (2026-11-07)

Maxi asked for a project that Sol 6.1 xhigh fails 20 to 40% of, without tricks, with VueUse in it, and then for the same runs with the Nuxt MCP and the core skill (B) and with module skills (C).

## Calibration

- Meetups v1 (22 probes): Sol 6.1 xhigh scored 91%, 91% and 91% (3 runs, about 75 min and $0.87 to $1.08 each, archived in `cli/.data/archive/calibration-sol-meetups-v1/`). It missed two probes in every run, and both were our fault:
  - `rsvp-server-400` wanted 400. Sol answered 422, which is a correct status for field errors. The probe now accepts both.
  - `price-ssr` wanted dollar and pound prices in the server HTML, but the prompt never said so. Sol read `navigator.language` and converted in the browser (with care for hydration). Feature 5 now says the price must be right in the first HTML.
- Meetups v2 (39 probes) adds features 7 to 12 and four requirements to features 1, 2 and 4. See `tasks/meetups/README.md` for each probe, its right forms and its tempting wrong form. The reference passes all 39, and `wrong-client` fails exactly its 17 targets.

## Setups

- **B**: the Nuxt MCP (`https://nuxt.com/mcp`) and the hosted core skill from `https://nuxt-skill.onmax.me/.well-known/skills` (what `npx skills add https://nuxt-skill.onmax.me/` installs). Snapshot in `setups/B/skills/nuxt`.
- **C**: the Nuxt MCP and the skill that `nuxt-skill-hub` 0.3.1 writes on `nuxt prepare` for this project (`nuxt-meetups`): the core rules, the official Nuxt UI skill, and for `@vueuse/nuxt` only a metadata router (a link to the docs), because neither the package nor its docs publish a skill. Snapshot in `setups/C/meetups/skills`.
- `pnpm evals skills <project>` refreshes both snapshots and records their source and hash in `setups/sources.json`.
- Skills go into the agent's own HOME (`.codex/skills`, `.claude/skills`), so the working copy is the same file tree in every setup.
- Codex lists a nested `SKILL.md` as its own skill, so B and C offer `vue-best-practices` next to `nuxt`. That is how a normal install behaves too.
- The audit now knows each setup: it fails a run that was offered skills or MCP servers outside its setup, or that missed the ones its setup installs. Claude Code's 16 bundled skills are allowed like Codex's 5 system skills.

## Traps found in v4

| Trap | Effect | Fix |
| --- | --- | --- |
| Claude Code walks up from its working folder for `.claude/skills` and `CLAUDE.md` | A working copy under `/home/maxi` gets Maxi's own skills and instructions | Working copies stay in `/tmp` (they always did for real runs; only a hand probe under `~/.cache` hit it). The audit now checks Claude's skill list. |
| Agents look for a browser on the machine | One Sol run used Playwright from the eval repo's `node_modules` to check its app | The audit flags any command that reads `nuxt-evals/tasks`, `cli`, `site`, `setups` or `research`. No run read probes or references. |
| `nuxt/server` in Nuxt 5 is a portable subset of h3 | `setResponseHeader` from `nuxt/server` fails the build (`MISSING_EXPORT`) | Return a `Response` with headers. A good trap for a Nuxt 5 skill. |
| Module-level state only leaks when requests interleave | With an in-memory store every request finishes in microtasks, so a shared `ref` never shows another user | The fixture's session lookup waits 15 ms, like a remote store. The probe reads `/dashboard`, which looks the session up again after the header did. |
| Nuxt UI derives every radius from `--ui-radius` | `rounded-md` is 1.5 × `--ui-radius` | The probe accepts 1 to 3 px for buttons, inputs and selects. |

## Results

Pending: Sol 6.1 xhigh A×3, B×3, C×3 on Meetups v2.

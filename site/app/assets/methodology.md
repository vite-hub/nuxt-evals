A coding agent gets a short prompt and an empty folder, and 60 minutes to build an app with Nuxt 5 and ViteHub. Then Opus 5.5 at high reasoning works as the judge. It marks 219 checks as passed or failed, fixed rules turn those marks into a score from 0 to 10, and Vite Doctor adds what a linter finds.

## The runs

- The agent is a model in its harness, Codex or Claude Code.
- It starts with an empty folder and an empty home folder. The web is open.
- At 60 minutes it stops, and what is in the folder gets graded.
- [Each run page](/runs/20261109-2002-meetups-v2-claude-code-a2) shows the whole session: thinking, commands, output and code.

### With or without skills?

The main reason I built this is to get some proof that skills make life easier for Nuxt and ViteHub developers. We cannot just write random skills and expect them to work without a proper scientific method. So each model runs in two modes:

- Without any help, just whatever the agent finds on the internet.
- With the [Nuxt MCP](https://nuxt.com/docs/guide/ai/mcp) and the skills I wrote in [nuxt-skills](https://github.com/onmax/nuxt-skills).

The runs with skills are still pending, so every score on the site today is without help. In both modes we try to copy what our users do on a normal day. No fancy prompts, as much vibe coding as possible, and we see what the agents are capable of.

## Projects

Each project has its own prompt, rubric and reference app. Its page has all three.

<!-- projects -->

## Fix and hidden-bug projects

Building an app from an empty folder is a small part of what people ask an agent to do. Most days they ask it to fix something in an app that already exists. So the other projects start from the Meetups reference app with its comments removed:

- **Fix projects** plant one bug and give the agent a user's report of it, with no skills. A script checks against the built app that the problem is gone; a run that fails it scores 0. Then the judge reads the change against the fixes I know for that bug, ranked from best to wrong, and grades whether the agent found the root cause, how good the fix is, whether it used the platform's own tool, whether it broke anything else, and whether it proved the fix. The vibe pass asks whether a maintainer would merge the change as it is.
- **The hidden-bug project** plants twelve bugs among code that looks wrong but is correct, and asks the agent to review the repo without running it. Each planted bug it finds counts; each correct piece of code it calls a bug costs.

The bugs come from a corpus of 115 cases, most of them from real fixes in ViteHub apps and in public repositories.

## The grading

The rubric has 219 checks in 26 sections, such as data fetching, database, auth, security and accessibility. 106 are major and 113 minor. Six sections grade ViteHub itself, one per part the app uses: setup, Database, Auth (passkeys included), Email, Blob and Jobs. The checks come from the Nuxt, Vue, Nitro, h3, ViteHub and Better Auth docs, and from replies to [a question on X](https://x.com/_onmax/status/2119005553775030726). One of them: "Ten parallel RSVPs from ten users for an event with two seats give exactly two seats."

The judge is Claude Code with Opus 5.5 at high reasoning. It installs, builds and starts the app, then tests it in a browser and reads the code. Every check comes back as pass, fail, n/a or unverified, with evidence. The judge never picks a score, and it doesn't know which app is the reference: it grades that one exactly like a run. These rules turn the marks into scores:

- A section scores the share of its checks that pass, times 10. A major check weighs 3 and a minor one 1. n/a counts as a pass; an unverified check is left out.
- A run's score is a weighted mean: the general sections share 65%, the six ViteHub sections 25%, and Vite Doctor 10%.
- An agent's score is the median of its runs. An app that does not build or start scores 0. A reference app I wrote goes through the same grading.

[Vite Doctor](https://vite-doctor.onmax.me) reads the installed app and reports what a linter can see: `process.env` in server code, imports of things Nuxt auto-imports, `../../` paths where an alias exists, `window` during setup. Errors weigh 3 and warnings 1, each rule counts at most 5 times, and the score is 10 × 15 / (15 + points). Rules that also fire on the reference app don't count.

The **vibe** column is a second judge pass on the design: missing or superfluous abstractions, what it rebuilds that Nuxt, Nitro, VueUse or ViteHub already give, and what a senior reviewer would ask to restructure even when everything works. It scores 0 to 10 against written anchors, compares with the reference app's code, and cites the lines behind every finding. It is shown on its own and is not part of the score.

Cost is the run's tokens at [models.dev](https://models.dev) list prices, not what I paid, and it leaves the judge out.

## Limits

- Two build projects, six fix projects and one hidden-bug project. Meetups has three runs per agent, and Meal planner has one Opus run so far. Runs of the same agent differ by up to 0.5, so a smaller gap means little.
- One judge grades each run once, and no human has checked a sample yet. That judge is Opus 5.5, which is also one of the agents.
- Each model runs at the effort its vendor recommends for a long unattended coding task: Opus 5.5 at medium (Claude Code's default), Fable 5.2 at high (Anthropic's guide for long agentic runs), Sol at xhigh.
- The rubric was made harder on purpose for this round, so frontier models land near the middle and the tooling has room to show a gain. The reference app is the yardstick, and I wrote both.
- An audit flags 7 of the 9 runs for commands outside their folder, mostly downloading ViteHub's package to read it. None read the eval's files, and they still count.

## About me

I am Maxi, [onmax](https://github.com/onmax) on GitHub. I am part of the Nuxt team and I maintain ViteHub. I also wrote the rubric and the reference app, so I am not neutral. That is why every session, every check and its evidence are open to read on this site.

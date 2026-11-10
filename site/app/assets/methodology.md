A coding agent gets a short prompt and an empty folder, and 60 minutes to build an app with Nuxt 5 and ViteHub. Then Opus 5.5 at high reasoning works as the judge. It marks 213 checks as passed or failed, and fixed rules turn those marks into a score from 1 to 5.

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

The only project so far is [Meetups](/projects/meetups-v2), a small meetup.com for tech events. Its page has the prompt, the full rubric and the reference app.

## The grading

The rubric has 213 checks in 21 sections, such as data fetching, database, auth, security and accessibility. 108 are major and 105 minor. They come from the Nuxt, Vue, Nitro, h3 and ViteHub docs, and from replies to [a question on X](https://x.com/_onmax/status/2119005553775030726). One of them: "Ten parallel RSVPs from ten users for an event with two seats give exactly two seats."

The judge is Claude Code with Opus 5.5 at high reasoning. It installs, builds and starts the app, then tests it in a browser and reads the code. Every check comes back as pass, fail, n/a or unverified, with evidence. The judge never picks a score. These rules do, for each section:

| Score | When |
| --- | --- |
| 5 | Every major check passes, at most one minor fails |
| 4 | Every major check passes, two or three minors fail |
| 3 | One major fails, or four or more minors fail |
| 2 | Two or three majors fail |
| 1 | Four or more majors fail, or the feature is missing |

A run's score is the mean of its sections, and an agent's score is the median of its runs. An app that does not build or start gets 1 in every section. A reference app I wrote goes through the same grading and scores 5.

Cost is the run's tokens at [models.dev](https://models.dev) list prices, not what I paid, and it leaves the judge out.

## Limits

- One project, three runs per agent. Runs of the same agent differ by up to 0.5, so a smaller gap means little.
- One judge grades each run once, and no human has checked a sample yet. That judge is Opus 5.5, which is also one of the agents.
- Reasoning levels differ: Luna runs at low, Sol at xhigh, Opus and Fable at high.
- An audit flags 10 of the 12 runs for commands outside their folder, mostly downloading ViteHub's package to read it. None read the eval's files, and they still count. The three Luna runs also had Codex's bundled skills on.

## About me

I am Maxi, [onmax](https://github.com/onmax) on GitHub. I am part of the Nuxt team and I maintain ViteHub. I also wrote the rubric and the reference app, so I am not neutral. That is why every session, every check and its evidence are open to read on this site.

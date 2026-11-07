# Nuxt Discord · team/general · thread "Hey team 👋 I think we can agree that"
https://discord.com/channels/473401852243869706/1567834385481338880

## onmax · 2026-11-05 09:34 UTC

[image: attachment.png]

## Flo0806 · 2026-11-05 10:07 UTC

Hi Max!
I work a lot with Claude Code and made some plugins and "mods" for it. In my experience Claude works just as well with or  without Nuxt plugins.
I think newer Models just understand modern web frameworks much better, even without plugins.
Just my 2 cents.

## Hugo · 2026-11-05 10:57 UTC

I would also like a nuxt plugin, but for now I still need to do a lot of benchmarks and found the best way to make it, because for example the nuxt mcp is not that used by coding agent

## Atinux · 2026-11-05 11:26 UTC

I still believe plugins or MCP is because of a bad API decision from the beginning, which is not the case so far for Nuxt IMO

## TheAlexLichter · 2026-11-05 14:39 UTC (reply)

Does Laravel has a lot of bad API decisions though? 🤔

## Atinux · 2026-11-05 15:03 UTC (reply)

Do they have evals showing how agents perform with and without the plugin? 🤔

## Atinux · 2026-11-05 15:05 UTC

This is what they expose: https://github.com/laravel/agent-skills/blob/main/.claude-plugin/marketplace.json

## Atinux · 2026-11-05 15:06 UTC

And appart the template upgrader and cloud related products, this seems to be the main skill: https://github.com/laravel/agent-skills/blob/main/laravel/agents/laravel-simplifier.md

## Atinux · 2026-11-05 15:06 UTC

(8 months ago)

## TheAlexLichter · 2026-11-05 15:33 UTC (reply)

AFAIK no, maybe internally. I can ask some folks over there if you want ☺️

## Atinux · 2026-11-05 15:38 UTC

I would appreciate thanks!

## onmax · 2026-11-05 20:24 UTC (reply)

To be honest this is not my case... of course it works for the 90/95% of cases. But sometimes you really need to push in certain directions. nonetheless, I agree. This is becoming less of a problem, but I dont think it will never go away.

From my point of view, docs for humans will be less relevant. I am starting to read less and less docs and asking more to my agents. I am using way more mcps and skills than ever. Maybe agents all they need is just access to the source code and they willl figure it out, but still I think a skill is way more important than any source code or any docs for humans.

## Atinux · 2026-11-05 20:54 UTC

Would you consider then skills being docs for agents

## Atinux · 2026-11-05 20:54 UTC

And if so, what should they be focusing on versus humans docs or source code to be efficient?

## onmax · 2026-11-06 07:24 UTC

I would say yes, skills are docs for agents. But they focus on different things:

- they can lead with code examples, not prose
- way more dense. most of the time you don't need to explain why, just how
- fix the habits models learned from old Nuxt 2 code, which still runs. Or teach newer APIs models dont know yet. For example, h3 has `validateBody` and agents rarely use it with one-shot
- one recipe for agents can mix many complex concepts at once. for humans you need one example per concept, agents just take what they need
- I treat skills like a compass. They dont have all the knowledge, but they hint the agent to specific direction

About evals, they are really hard to do well (and expensive). We already talked about this a few months ago, but evals at 100% like https://nuxt.com/evals don't really tell us much. Right now they are mostly useful to compare open source models. I would love to build more complex ones that really test what agents struggle with, I already asked about it in the past and I'm still happy to work on it if we want to invest in it 🙂

## Atinux · 2026-11-06 10:32 UTC

cc @benjamincanac I believe adding more complex evals from @onmax would be awesome


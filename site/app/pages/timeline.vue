<script setup lang="ts">
/** The same model and project without and with skills, as medians of three runs on the 0 to 100 scale. */
const comparisons = [
  { model: "Opus 5.5 medium", project: "Meetups", skills: "Nuxt MCP + nuxt-skills", bare: 73, with: 78, cost: "$9 → $19" },
  { model: "Opus 5.5 medium", project: "Meal planner", skills: "Vue skills", bare: 82, with: 78, cost: "$11 → $18" },
  { model: "GPT-6.2 Sol xhigh", project: "Meetups", skills: "Nuxt MCP + nuxt-skills", bare: 75, with: 73, cost: "$3.0 → $3.4" },
  { model: "GPT-6.2 Sol xhigh", project: "Meal planner", skills: "Vue skills", bare: 77, with: 74, cost: "$2.1 → $2.1" },
]

interface Step {
  date: string
  title: string
  body: string
  facts?: string[]
  links?: { to: string, label: string }[]
  milestone?: boolean
}

const steps: Step[] = [
  {
    date: "5 Nov",
    title: "The question",
    body: "In the Nuxt team chat Flo said Claude works just as well with or without Nuxt plugins, and Sébastien said plugins and MCP mostly paper over bad APIs. I argued that skills are docs for agents, and that evals at 100%, like nuxt.com/evals, can't tell either way. So I offered to build harder ones.",
    milestone: true,
  },
  {
    date: "7 Nov",
    title: "First runs",
    body: "Research on other suites (next-evals, Laravel Boost, svelte-evals, SWE-bench), a results site on Cloudflare built with ViteHub, and a runner for Codex and Claude Code. The first task was a contact endpoint. Then Meetups: an app with 12 features, graded by 35 scripted probes, and two setups with the Nuxt MCP and skills.",
    facts: ["Every agent session is public, with its commands and code"],
  },
  {
    date: "8 Nov",
    title: "Probes saturate",
    body: "Agents passed every probe, so the probes measured nothing. I wrote a reference Meetups app on Nuxt 5 and ViteHub (database, auth, email, rate limit) and had a council of models review it twice.",
  },
  {
    date: "9 Nov",
    title: "A rubric and a judge",
    body: "Probes gave way to a rubric of more than 200 checks taken from the Nuxt, Vue, Nitro, h3, ViteHub and Better Auth docs. Opus 5.5 grades each app in a browser and in its code, blind to which one is the reference. The reference passes.",
  },
  {
    date: "10 Nov",
    title: "Meetups gets hard",
    body: "Passkeys, cover photos, a reminder the day before and password reset by email. ViteHub became six sections worth 25%, Vite Doctor joined the score, and every failed check got its cited code and a fix. The Methodology page went live.",
    facts: ["Fable 5.2 76", "Opus 5.5 73", "Sol 6.1 66", "all without skills"],
    links: [{ to: "/projects/meetups", label: "Meetups" }],
  },
  {
    date: "12 Nov",
    title: "Meal planner",
    body: "A second project with no Nuxt at all: Vue 3 and Vue Router over 20,289 recipes, with households and allergies, a pantry, share links, two languages, offline and a 4× slower CPU. The first version was too easy (Opus 90), so it got harder (Opus 82).",
    links: [{ to: "/projects/meal-planner", label: "Meal planner" }],
  },
  {
    date: "13 Nov",
    title: "Three runs per agent",
    body: "Fable, Opus and Sol ran Meal planner three times each, and the landing page became one matrix of every project. Runs of the same agent differ by up to 5 points, so a smaller gap means little.",
  },
  {
    date: "14 Nov",
    title: "Fix and hidden-bug evals",
    body: "Greenfield apps are a small part of real prompts, so I added six projects with one planted bug and a user's report, and one that scans Meetups for hidden bugs among decoys, from a corpus of 115 cases.",
  },
  {
    date: "16 Nov",
    title: "Scores from 0 to 100",
    body: "The site moved to a 0 to 100 scale like most evals. Luna at low effort left the results: it scored 22 and said little about the others.",
  },
  {
    date: "17 Nov",
    title: "The first run with skills",
    body: "Sol 6.1 with the Vue skills on Meal planner scored 71, the same as without them. Its biggest gains were on topics the skills never mention. That run also used a higher effort than the one without skills, so the two were not a fair pair yet.",
    facts: ["71 without", "71 with"],
    milestone: true,
  },
  {
    date: "19 Nov",
    title: "Better skills",
    body: "New descriptions in nuxt-skills so agents pick the right one, and the setup with skills became the Nuxt MCP plus a pinned set of nuxt-skills for the stack.",
  },
  {
    date: "21 Nov",
    title: "Fix evals go, \"USE ALL THE SKILLS.\"",
    body: "On the fix cases models scored 97 to 99 against the reference's 98, so skills had no room to help, and those 48 runs left the site. Opus with skills barely opened them, so a second setup adds one line to the prompt: \"USE ALL THE SKILLS.\" Every cell on the landing page now splits into without and with skills.",
  },
  {
    date: "22 Nov",
    title: "Opus with skills",
    body: "Opus read the skills when told to. Meal planner went from 82 to 78 and took about 70 minutes instead of 46. Meetups went from 73 to 78, at the edge of the noise, and cost twice as much. Claude Code's bundled skills were switched off after Opus ran all of them.",
    facts: ["Meal planner 82 → 78", "Meetups 73 → 78"],
  },
  {
    date: "23 Nov",
    title: "GPT-6.2 Sol with skills",
    body: "Sol opened every skill and read their references. It still scored lower with them on both projects. Skills raised its vibe score on Meal planner, the judge's read of the design, but not the rubric.",
    facts: ["Meal planner 77 → 74", "Meetups 75 → 73"],
  },
  {
    date: "24 Nov",
    title: "The end",
    body: "Two frontier models, two projects, three runs each side: skills didn't make the apps better. I stopped running experiments here. The results, every session and the methodology stay online.",
    milestone: true,
  },
]

const delta = (row: { bare: number, with: number }) => {
  const value = row.with - row.bare
  return value > 0 ? `+${value}` : `${value}`
}

useSeoMeta({
  title: "Timeline · Nuxt agent evals",
  description: "Three weeks of Nuxt agent evals, step by step, and why they ended: skills didn't make the apps better.",
})
</script>

<template>
  <article class="py-10">
    <h1 class="text-2xl font-medium tracking-tight text-highlighted">
      Timeline
    </h1>
    <p class="mt-4 leading-7 text-pretty text-default">
      I built these evals to prove that skills help coding agents write better Nuxt. After three weeks the data says they don't, at least not for today's frontier models, so the project ends here. This page tells how it went, step by step.
    </p>

    <section
      aria-labelledby="result-heading"
      class="mt-10"
    >
      <h2
        id="result-heading"
        class="text-sm font-medium text-highlighted"
      >
        The result
      </h2>
      <p class="mt-1.5 text-sm leading-6 text-muted">
        Median of three runs per side, from 0 to 100. A gap under 5 points is within run-to-run noise.
      </p>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="text-left text-xs text-muted">
              <th
                scope="col"
                class="py-2 pr-4 font-normal"
              >
                Model and project
              </th>
              <th
                scope="col"
                class="py-2 pr-4 text-right font-normal"
              >
                Without
              </th>
              <th
                scope="col"
                class="py-2 pr-4 text-right font-normal"
              >
                With skills
              </th>
              <th
                scope="col"
                class="py-2 pr-4 text-right font-normal"
              >
                Gap
              </th>
              <th
                scope="col"
                class="py-2 text-right font-normal max-sm:hidden"
              >
                Cost per run
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in comparisons"
              :key="`${row.model}-${row.project}`"
              class="border-t border-default"
            >
              <td class="py-2.5 pr-4">
                <span class="block text-highlighted">{{ row.model }}</span>
                <span class="block text-[13px] text-muted">{{ row.project }}</span>
              </td>
              <td class="py-2.5 pr-4 text-right">
                {{ row.bare }}
              </td>
              <td class="py-2.5 pr-4 text-right">
                {{ row.with }}
              </td>
              <td
                class="py-2.5 pr-4 text-right font-medium"
                :class="row.with > row.bare ? 'text-success' : 'text-error'"
              >
                {{ delta(row) }}
              </td>
              <td class="py-2.5 text-right text-muted max-sm:hidden">
                {{ row.cost }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-4 text-sm leading-6 text-muted">
        One gain of 5 at the edge of the noise, three losses. With skills, Opus cost about twice as much and Sol a little more. In these runs the agent was told "USE ALL THE SKILLS.", because left alone Opus barely opened them, and the Nuxt MCP was called at most twice per run. Without skills, the models already knew Vue and Nuxt well. Most checks they failed were details no skill covers, like rare letters in search, offline updates, focus and contrast.
      </p>
    </section>

    <section
      aria-labelledby="steps-heading"
      class="mt-14"
    >
      <h2
        id="steps-heading"
        class="text-sm font-medium text-highlighted"
      >
        Step by step, November 2026
      </h2>
      <ol class="mt-6">
        <li
          v-for="(step, index) in steps"
          :key="step.date + step.title"
          class="grid grid-cols-[3.75rem_1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4.5rem_1.25rem_minmax(0,1fr)]"
        >
          <time class="pt-px text-right text-[13px] tabular-nums text-muted">{{ step.date }}</time>
          <div
            class="relative flex justify-center"
            aria-hidden="true"
          >
            <span
              v-if="index < steps.length - 1"
              class="absolute top-4 bottom-0 w-px bg-(--ui-border)"
            />
            <span
              class="relative mt-1.5 size-2.5 rounded-full"
              :class="step.milestone ? 'bg-inverted' : 'border-[1.5px] border-(--ui-border-accented) bg-default'"
            />
          </div>
          <div class="pb-9">
            <h3 class="font-medium text-highlighted">
              {{ step.title }}
            </h3>
            <p class="mt-1 text-[15px] leading-7 text-pretty text-default">
              {{ step.body }}
            </p>
            <ul
              v-if="step.facts?.length"
              class="mt-2.5 flex flex-wrap gap-1.5"
            >
              <li
                v-for="fact in step.facts"
                :key="fact"
                class="rounded-md bg-elevated px-2 py-0.5 text-[13px] tabular-nums text-highlighted"
              >
                {{ fact }}
              </li>
            </ul>
            <p
              v-if="step.links?.length"
              class="mt-2.5 flex gap-4 text-sm"
            >
              <NuxtLink
                v-for="link in step.links"
                :key="link.to"
                :to="link.to"
                class="text-muted underline decoration-(--ui-border-accented) underline-offset-4 transition-colors hover:text-highlighted"
              >
                {{ link.label }}
              </NuxtLink>
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section
      aria-labelledby="numbers-heading"
      class="mt-6 border-t border-default pt-8"
    >
      <h2
        id="numbers-heading"
        class="text-sm font-medium text-highlighted"
      >
        In numbers
      </h2>
      <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <div>
          <dt class="text-xs text-muted">
            Days
          </dt>
          <dd class="mt-0.5 text-xl tabular-nums text-highlighted">
            18
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Agent runs
          </dt>
          <dd class="mt-0.5 text-xl tabular-nums text-highlighted">
            100+
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Still on the site
          </dt>
          <dd class="mt-0.5 text-xl tabular-nums text-highlighted">
            40
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Their list price
          </dt>
          <dd class="mt-0.5 text-xl tabular-nums text-highlighted">
            $392
          </dd>
        </div>
      </dl>
      <p class="mt-6 text-sm leading-6 text-muted">
        Every run on the site keeps its full session, files and graded checks. The
        <NuxtLink
          to="/methodology"
          class="underline decoration-(--ui-border-accented) underline-offset-4 hover:text-highlighted"
        >methodology</NuxtLink>
        explains how each score was made.
      </p>
    </section>
  </article>
</template>

<script setup lang="ts">
/** The same model and project without and with skills, as medians of three runs on the 0 to 100 scale. */
const comparisons = [
  { model: "Opus 5.5 medium", project: "Meetups", skills: "Nuxt MCP + nuxt-skills", bare: 73, with: 78, cost: "$9 → $19" },
  { model: "Opus 5.5 medium", project: "Meal planner", skills: "Vue skills", bare: 82, with: 78, cost: "$11 → $18" },
  { model: "GPT-6.2 Sol xhigh", project: "Meetups", skills: "Nuxt MCP + nuxt-skills", bare: 75, with: 73, cost: "$3.0 → $3.4" },
  { model: "GPT-6.2 Sol xhigh", project: "Meal planner", skills: "Vue skills", bare: 77, with: 74, cost: "$2.1 → $2.1" },
]

const resultNotes = [
  "Without skills, both models already knew Vue and Nuxt well. Most failures were app details no skill covers: rare letters in search, offline updates, focus, and contrast.",
  "Runs with skills added \"USE ALL THE SKILLS.\" to the prompt because Opus barely opened skills on its own.",
  "The Nuxt MCP was called at most once per run. Sol searched its docs once on Meetups, and Opus never called it.",
  "One +5 gain, within the noise, and three drops.",
  "With skills, Opus cost about twice as much per run and Sol cost a little more.",
]

type TextPart = string | { label: string, href: string }

interface Step {
  date: string
  title: string
  body: string | TextPart[]
  facts?: string[]
  links?: { to: string, label: string }[]
  milestone?: boolean
}

const steps: Step[] = [
  {
    date: "5 Nov",
    title: "The question",
    body: [
      "In the Nuxt team chat, ",
      { label: "Flo (@Flo0806)", href: "https://github.com/Flo0806" },
      " said Claude works just as well without Nuxt plugins. ",
      { label: "Sébastien (@atinux)", href: "https://github.com/atinux" },
      " said plugins and MCP paper over bad APIs. I argued skills are agent docs, and that evals where models score 100%, like nuxt.com/evals, can't tell. So I offered to build harder ones.",
    ],
    milestone: true,
  },
  {
    date: "7 Nov",
    title: "First runs",
    body: "I built this site on Cloudflare with ViteHub and a runner for Codex and Claude Code. I added Meetups, a 12-feature Nuxt 5 full-stack app with 35 automated tests. Every session is public.",
    links: [
      { to: "/runs/20261122-1513-meetups-opus-cs1", label: "Example session" },
      { to: "/", label: "All runs" },
    ],
  },
  {
    date: "8 Nov",
    title: "Automated tests hit 100%",
    body: "Every agent passed all 35 tests, so they couldn't tell models apart. I built a reference Meetups app on Nuxt 5 and ViteHub to grade against and had several models review it twice.",
  },
  {
    date: "9 Nov",
    title: "A rubric and a judge",
    body: "I replaced the 35 tests with over 200 rubric checks from the stack's docs. Opus 5.5 judges each app blind in a browser and reads its code. The reference passes.",
  },
  {
    date: "10 Nov",
    title: "Meetups (Nuxt app) gets harder",
    body: "I added harder features like passkeys and password resets. ViteHub became 25% of the score, Vite Doctor linting joined, and failed checks cite code lines with a fix.",
    facts: [
      "Fable 5.2 · Meetups: 76 without skills",
      "Opus 5.5 · Meetups: 73 without skills",
      "Sol 6.1 · Meetups: 66 without skills",
    ],
    links: [
      { to: "/projects/meetups", label: "Meetups" },
      { to: "/methodology", label: "Methodology" },
    ],
  },
  {
    date: "12 Nov",
    title: "Meal planner (Vue app)",
    body: "I added a Vue 3 and Vue Router app with no Nuxt, 20,289 recipes, offline support, and a 4× slower CPU test. Opus scored 90 at first, then 82 after I made it harder.",
    links: [{ to: "/projects/meal-planner", label: "Meal planner" }],
  },
  {
    date: "13 Nov",
    title: "Three runs per agent",
    body: "Fable, Opus, and Sol each ran Meal planner three times. The same agent varied by up to 7 points, so smaller gaps mean little.",
  },
  {
    date: "14 Nov",
    title: "Bug-fix and hidden-bug evals",
    body: "Most real prompts are \"fix this\", not fresh builds. I added six single-bug projects and a Meetups scan for hidden bugs from 115 cases.",
  },
  {
    date: "16 Nov",
    title: "Scores from 0 to 100",
    body: "I switched the site to a 0 to 100 scale and removed Luna at low effort, which scored 22.",
  },
  {
    date: "17 Nov",
    title: "The first run with skills",
    body: "With the Vue skills, Sol 6.1 scored 71, the same as without, and gained most on topics the skills never mention. The run with skills also used a higher effort, so it wasn't a fair pair yet.",
    facts: ["Sol 6.1 · Meal planner: 71 without → 71 with skills"],
    milestone: true,
  },
  {
    date: "19 Nov",
    title: "Better skills",
    body: "I rewrote the nuxt-skills descriptions so agents pick the right ones, and paired a fixed set with the Nuxt MCP.",
  },
  {
    date: "21 Nov",
    title: "Fix evals removed, \"USE ALL THE SKILLS.\"",
    body: "Models scored 97 to 99 on bug fixes against the reference's 98, so I dropped those 48 runs. Opus barely opened skills on its own, so I added \"USE ALL THE SKILLS.\" to the prompt.",
  },
  {
    date: "22 Nov",
    title: "Opus with skills",
    body: "Opus read the skills when told. Meal planner slowed from 47 to about 70 minutes, and Meetups doubled in cost for a +5 within the noise. I turned off Claude Code's built-in skills after the prompt triggered them.",
    facts: [
      "Opus 5.5 · Meal planner: 82 without → 78 with skills",
      "Opus 5.5 · Meetups: 73 without → 78 with skills",
    ],
  },
  {
    date: "23 Nov",
    title: "GPT-6.2 Sol with skills",
    body: "Sol read the skills, often all in its first command, yet scored lower on both projects. Skills raised its code-design vibe score on Meal planner, not its rubric score.",
    facts: [
      "GPT-6.2 Sol · Meal planner: 77 without → 74 with skills",
      "GPT-6.2 Sol · Meetups: 75 without → 73 with skills",
    ],
  },
  {
    date: "24 Nov",
    title: "The end",
    body: "Two top models, two projects, three runs per side. Skills didn't help, so I stopped here. The results, sessions, and methodology stay online.",
    milestone: true,
  },
]

const stats = [
  { label: "Days", value: "18" },
  { label: "Agent runs", value: "100+" },
  { label: "Still on the site", value: "40" },
  { label: "Their list price", value: "$392" },
]

const delta = (row: { bare: number, with: number }) => {
  const value = row.with - row.bare
  return value > 0 ? `+${value}` : `${value}`
}

const bodyParts = (body: Step["body"]): TextPart[] => (typeof body === "string" ? [body] : body)

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
      I built these evals to prove that agent skills help Codex and Claude Code write better Nuxt. After three weeks, the data says they don't on today's top models, so the project ends here. Here is the result and how it went.
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
        Median of three runs per side, from 0 to 100. Three runs of the same setup vary by up to 9 points, so a gap of 5 or less is noise.
      </p>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="text-left text-xs text-muted">
              <th
                scope="col"
                class="py-2 pr-3 font-normal sm:pr-4"
              >
                Model and project
              </th>
              <th
                scope="col"
                class="py-2 pr-3 text-right font-normal whitespace-nowrap sm:pr-4"
              >
                Without<sup class="ml-0.5 text-[10px] leading-none font-normal"><a
                  href="#note-1"
                  aria-label="Note 1"
                  class="px-0.5 text-muted underline decoration-(--ui-border-accented) underline-offset-2 transition-colors hover:text-highlighted"
                >1</a></sup>
              </th>
              <th
                scope="col"
                class="py-2 pr-3 text-right font-normal sm:pr-4"
              >
                With <span class="whitespace-nowrap">skills<sup class="ml-0.5 text-[10px] leading-none font-normal"><a
                  href="#note-2"
                  aria-label="Note 2"
                  class="px-0.5 text-muted underline decoration-(--ui-border-accented) underline-offset-2 transition-colors hover:text-highlighted"
                >2</a><span aria-hidden="true">,</span><a
                  href="#note-3"
                  aria-label="Note 3"
                  class="px-0.5 text-muted underline decoration-(--ui-border-accented) underline-offset-2 transition-colors hover:text-highlighted"
                >3</a></sup></span>
              </th>
              <th
                scope="col"
                class="py-2 text-right font-normal whitespace-nowrap sm:pr-4"
              >
                Gap<sup class="ml-0.5 text-[10px] leading-none font-normal"><a
                  href="#note-4"
                  aria-label="Note 4"
                  class="px-0.5 text-muted underline decoration-(--ui-border-accented) underline-offset-2 transition-colors hover:text-highlighted"
                >4</a></sup>
              </th>
              <th
                scope="col"
                class="py-2 text-right font-normal whitespace-nowrap max-sm:hidden"
              >
                Cost per run<sup class="ml-0.5 text-[10px] leading-none font-normal"><a
                  href="#note-5"
                  aria-label="Note 5"
                  class="px-0.5 text-muted underline decoration-(--ui-border-accented) underline-offset-2 transition-colors hover:text-highlighted"
                >5</a></sup>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in comparisons"
              :key="`${row.model}-${row.project}`"
              class="border-t border-default"
            >
              <td class="py-2.5 pr-3 sm:pr-4">
                <span class="block text-highlighted">{{ row.model }}</span>
                <span class="block text-[13px] text-muted">{{ row.project }}</span>
              </td>
              <td class="py-2.5 pr-3 text-right sm:pr-4">
                {{ row.bare }}
              </td>
              <td class="py-2.5 pr-3 text-right sm:pr-4">
                {{ row.with }}
              </td>
              <td
                class="py-2.5 text-right font-medium sm:pr-4"
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
      <ol class="mt-4 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted marker:tabular-nums">
        <li
          v-for="(note, index) in resultNotes"
          :id="`note-${index + 1}`"
          :key="note"
          class="scroll-mt-20 target:text-highlighted"
        >
          {{ note }}
        </li>
      </ol>
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
          <div :class="index < steps.length - 1 ? 'pb-9' : ''">
            <h3 class="font-medium text-highlighted">
              {{ step.title }}
            </h3>
            <p class="mt-1 text-[15px] leading-7 text-pretty text-default">
              <template
                v-for="(part, partIndex) in bodyParts(step.body)"
                :key="partIndex"
              >
                <template v-if="typeof part === 'string'">{{ part }}</template>
                <a
                  v-else
                  :href="part.href"
                  target="_blank"
                  rel="noopener"
                  class="underline decoration-(--ui-border-accented) underline-offset-4 transition-colors hover:text-highlighted"
                >{{ part.label }}</a>
              </template>
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
              class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm"
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
      class="mt-14"
    >
      <h2
        id="numbers-heading"
        class="text-sm font-medium text-highlighted"
      >
        In numbers
      </h2>
      <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <div
          v-for="stat in stats"
          :key="stat.label"
        >
          <dt class="text-xs text-muted">
            {{ stat.label }}
          </dt>
          <dd class="mt-0.5 text-xl tabular-nums text-highlighted">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
      <p class="mt-6 text-sm leading-6 text-muted">
        Every run on the site keeps its full session, files, and graded checks. The
        <NuxtLink
          to="/methodology"
          class="underline decoration-(--ui-border-accented) underline-offset-4 transition-colors hover:text-highlighted"
        >methodology</NuxtLink>
        explains how each score works.
      </p>
    </section>
  </article>
</template>

import type { Task } from "../types.ts"

/**
 * Meal planner: a Vue 3 + Vue Router single-page app with no backend. The agent starts with the recipe data in
 * `fixture/data` (written by `data.mjs`) and the vague PROMPT.md. The Opus judge grades it against RUBRIC.md, next
 * to the reference app in `reference/`.
 */
const task: Task = {
  id: "meal-planner",
  title: "Meal planner",
  rubric: true,
  probes: [],
  // A bigger app than Meetups, with no service to lean on: two hours, so the score measures the app, not the clock.
  timeLimitMinutes: 120,
  judge: {
    groups: [
      { name: "product", sections: ["P"] },
      { name: "households-shopping-sharing", sections: ["H", "B", "D"] },
      { name: "languages-offline-performance", sections: ["I", "O", "C"] },
      { name: "flows", sections: ["J"] },
      { name: "routing-state-units-dates", sections: ["R", "S", "N", "T"] },
      { name: "vue-forms-ui-a11y", sections: ["Q", "V", "U", "W"] },
      { name: "security-errors-tests-types-files-deploy-agent", sections: ["X", "G", "E", "Y", "F", "K", "Z"] },
    ],
    setupChecks: ["P1"],
    build: "Read the app's README and package.json. Install its dependencies and make a production build the way they say (for Vite usually `vite build`, output in dist). The app has no backend: the build is static files.",
    setupGrading: port => `Grade P1: serve the production build on port ${port} the way the README says (for Vite usually \`vite preview --host 127.0.0.1 --port ${port} --strictPort\`), open the home page in Chromium, and check that recipes show. In startCommand, write the port as \`$PORT\`, which we set (for example \`npx vite preview --host 127.0.0.1 --port $PORT --strictPort\`).`,
    sharedServer: (origin, _group, app) => `The production build is served at ${origin}. Don't stop, restart or rebuild it, and don't run a build in ${app}: the build output is already there (usually dist/), so read chunks and sizes from it. Other graders use the same server at the same time, but each Playwright browser context has its own storage: start every check from a fresh context. Run the app's tests and type check in ${app} through \`heavy\`.`,
    rules: (app, scratch) => [
      "Grade what the app does and how its code is written. Accept every correct alternative: hash or HTML5 history, VueUse or a good hand-written equivalent, localStorage or IndexedDB, plain CSS or a CSS tool. Never grade file layout for its own sake.",
      `The recipe data is in ${app}/data (its README has the fields and the US measures). Compute expected numbers from it with a Node script in ${scratch}.`,
      "Set the time zone, locale and color scheme per Playwright context (`timezoneId`, `locale`, `colorScheme`) and the time with `page.clock`. Two pages of one context are two tabs that share storage.",
      `Checks that need a second build (a new version for the update checks): copy the app with \`rsync -a --exclude node_modules --exclude dist ${app}/ ${scratch}/v2/ && ln -s ${app}/node_modules ${scratch}/v2/node_modules\`, build and serve it there on a spare port, and never rebuild in ${app}.`,
    ],
    apis: "Vue 3, Vue Router 5, VueUse, Vite or web platform",
  },
}

export default task

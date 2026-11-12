import type { Task } from "../types.ts"

/**
 * Meetups: the agent starts in an empty folder with the vague PROMPT.md. It has no probes; the Opus judge grades
 * the run against RUBRIC.md (`pnpm evals judge <id>`), and the reference app in `reference/` is the yardstick.
 */
const task: Task = {
  id: "meetups",
  title: "Meetups",
  rubric: true,
  probes: [],
  judge: {
    groups: [
      { name: "product", sections: ["P"] },
      { name: "vitehub", sections: ["I", "J", "L", "M", "O", "N"] },
      { name: "data-state-ssr-server", sections: ["D", "S", "H", "R"] },
      { name: "db-auth-validation-cache-time-seo-security", sections: ["B", "A", "V", "C", "T", "E", "X"] },
      { name: "ui-vue-files-types-a11y-errors-deploy-agent", sections: ["U", "Q", "F", "Y", "W", "G", "K", "Z"] },
    ],
    // P3 restarts the server, so the setup session grades it.
    setupChecks: ["P1", "P3"],
    build: "Read the app's README and package.json. Install its dependencies, prepare a fresh database the way the README or scripts say, and make a production build (for Nuxt usually `nuxt build`, output in .output). If the app needs settings such as an auth secret, put generated values in a .env file in the app folder the way its README or .env.example says. Leave third-party keys unset.",
    setupGrading: port => `Grade these checks. For P3, start the production server on port ${port} (set PORT, NITRO_PORT, HOST=127.0.0.1 and NITRO_HOST=127.0.0.1), sign up a user, restart the server, and see whether the session survives.`,
    sharedServer: (origin, group, app) => `The production build is running at ${origin} with a database only graders use. Don't stop, restart or rebuild it, and don't run \`nuxt build\`, \`nuxt prepare\` or migrations in ${app}. Other graders use the same server at the same time: make your own accounts with unique emails (judge-${group.split("-")[0]}-<n>@example.test) and your own events. The app may rate-limit sign-ups per client address; spread them out, wait when it answers 429, or send from another loopback address (\`curl --interface 127.0.0.2\`).`,
    rules: (app, scratch) => [
      "Grade what the app does and how its code is written. Accept every correct alternative: useAsyncData instead of useFetch, plain HTML instead of a UI library. The prompt asks for ViteHub, but only section I grades whether the app uses it: elsewhere, grade the behavior and the code whatever library provides them. Never grade file layout for its own sake.",
      "No third-party API keys are available (mail, exchange rates). A check that only needs a key to send is judged from the code and from what the app does without the key.",
      `Checks that need \`nuxt dev\` (the dev outbox, a manual schedule run): never run it in ${app}, where other graders work. Make your own copy, \`rsync -a --exclude node_modules --exclude .output --exclude .nuxt --exclude .vitehub/data ${app}/ ${scratch}/dev/ && ln -s ${app}/node_modules ${scratch}/dev/node_modules\`, migrate its fresh database the way the README says, and run it there on a free port. Stop it when you are done.`,
    ],
    apis: "Nuxt 5, Nitro v3, h3 v2, Vue, Better Auth or ViteHub",
  },
}

export default task

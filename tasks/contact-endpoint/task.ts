import type { Task } from "../types"

const task: Task = {
  id: "contact-endpoint",
  title: "Validated contact endpoint",
  probes: [
    {
      id: "route-exists",
      title: "A POST route for the contact form exists in server/",
      layer: "gate",
      check: ({ files }) => files.some(file => /^server\/.*contact.*\.post\.ts$/.test(file.path) || /^server\/.*contact.*\.ts$/.test(file.path)),
    },
    {
      id: "schema-validation",
      title: "The body is validated with a schema (any h3 or Valibot form)",
      layer: "static",
      check: ({ source }) => /readValidatedBody|v\.parse\(|v\.safeParse\(|safeParse\(|\.parse\(/.test(source),
    },
    {
      id: "explicit-h3-imports",
      title: "Server code imports h3 helpers explicitly (Nitro v3 has no server auto-imports)",
      layer: "static",
      check: ({ source }) => /from ["']h3["']/.test(source),
    },
    {
      id: "status-400",
      title: "Invalid input is answered with status 400",
      layer: "static",
      check: ({ source }) => /readValidatedBody/.test(source) || /status(Code)?:\s*400/.test(source) || /HTTPError/.test(source),
    },
    {
      id: "no-h3-v1-habits",
      title: "No h3 v1 habits (event.node.req, defineEventHandler from nitropack)",
      layer: "static",
      check: ({ source }) => !/event\.node\.req|from ["']nitropack/.test(source),
    },
  ],
}

export default task

import { defineHandler, HTTPError, readValidatedBody } from "h3"
import { z } from "zod"
import { createProject, getProject, slugify } from "../utils/store"

const body = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Use 40 characters or fewer"),
  visibility: z.enum(["private", "public"]),
})

export default defineHandler(async (event) => {
  const input = await readValidatedBody(event, body)
  if (!slugify(input.name)) throw new HTTPError({ status: 400, message: "Use letters or numbers in the name" })
  if (getProject(slugify(input.name))) throw new HTTPError({ status: 409, message: "A project with this name exists" })
  return createProject(input)
})

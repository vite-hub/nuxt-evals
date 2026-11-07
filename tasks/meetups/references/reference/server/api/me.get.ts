import { defineEventHandler } from "nuxt/server"

export default defineEventHandler(event => getSessionUser(event))

import { defineEventHandler } from "nuxt/server"
import { requireUser } from "../utils/store"

export default defineEventHandler(event => requireUser(event))

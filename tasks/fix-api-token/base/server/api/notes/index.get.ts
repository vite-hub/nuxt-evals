import { defineEventHandler } from "nuxt/server"
import { notesOf, requireUser } from "../../utils/store"

export default defineEventHandler(event => notesOf(requireUser(event).id))

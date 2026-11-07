import { defineEventHandler } from "nuxt/server"
import { cities } from "../data/events"

export default defineEventHandler(() => cities)

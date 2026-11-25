import { defineHandler } from "h3"
import { listProjects } from "../utils/store"

export default defineHandler(() => listProjects())

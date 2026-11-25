import { defineHandler } from "h3"
import { listDeployments } from "../utils/store"

export default defineHandler(() => listDeployments())

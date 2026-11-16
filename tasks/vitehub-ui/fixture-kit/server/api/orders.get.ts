import { defineHandler } from "h3"
import { listOrders } from "../utils/orders"

export default defineHandler(() => listOrders())

import { defineHandler, readValidatedBody } from "h3"
import { z } from "zod"
import { createOrder } from "../utils/orders"

const body = z.object({
  address: z.string().trim().min(1, "Address is required").max(200),
  cardName: z.string().trim().min(1, "Name on card is required").max(100),
})

export default defineHandler(async event => createOrder(await readValidatedBody(event, body)))

// Orders from the checkout, in memory. Every start has none.

export interface Order {
  id: string
  address: string
  cardName: string
  createdAt: string
}

const orders: Order[] = []

export const listOrders = (): Order[] => orders

export function createOrder(input: { address: string, cardName: string }): Order {
  const order = { id: `order-${orders.length + 1}`, ...input, createdAt: new Date().toISOString() }
  orders.push(order)
  return order
}

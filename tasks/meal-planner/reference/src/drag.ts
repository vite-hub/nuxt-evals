/** What a drag carries: a recipe from the shelf, or a meal already in the plan. */
export type DragItem = { kind: "recipe", id: string } | { kind: "entry", id: string }

const type = "application/x-meal-planner"

export function startDrag(event: DragEvent, item: DragItem) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(type, `${item.kind}:${item.id}`)
  event.dataTransfer.effectAllowed = item.kind === "recipe" ? "copy" : "move"
}

export function carriesItem(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes(type) ?? false
}

/** What was dropped, from a drag this app started. */
export function droppedItem(event: DragEvent): DragItem | null {
  const [kind, id] = event.dataTransfer?.getData(type).split(":", 2) ?? []
  return (kind === "recipe" || kind === "entry") && id ? { kind, id } : null
}

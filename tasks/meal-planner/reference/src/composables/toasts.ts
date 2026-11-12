import { readonly, ref } from "vue"

export interface Toast {
  id: number
  message: string
  tone: "info" | "error"
  /** A button on the toast, such as Undo. */
  action?: { label: string, run: () => void }
}

const list = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let next = 1

/** The app's messages. Screen readers hear them through the live regions in ToastRegion. */
export const toasts = readonly(list)

export function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  list.value = list.value.filter(toast => toast.id !== id)
}

/**
 * Shows a message. The same message again replaces the one on screen, so it is announced again (a second Undo) without
 * stacking. Errors stay until dismissed; the rest go after a few seconds, or after eight when they offer an action, so
 * there is time to press Undo.
 */
export function notify(message: string, tone: Toast["tone"] = "info", action?: Toast["action"]) {
  for (const same of list.value.filter(toast => toast.message === message)) dismiss(same.id)
  const id = next++
  for (const old of list.value.slice(0, -3)) dismiss(old.id)
  list.value = [...list.value, { id, message, tone, ...(action ? { action } : {}) }]
  if (tone === "info") timers.set(id, setTimeout(() => dismiss(id), action ? 8000 : 5000))
}

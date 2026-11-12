import { nextTick } from "vue"

/**
 * Focuses the first match of `selector` once Vue has rendered the change in progress, so keyboard and screen reader
 * users carry on from a control that exists (the moved row, the page's new heading) instead of falling back to `body`.
 */
export async function focusAfterRender(selector: string, root: ParentNode | null | undefined = document, options?: FocusOptions): Promise<void> {
  await nextTick()
  root?.querySelector<HTMLElement>(selector)?.focus(options)
}

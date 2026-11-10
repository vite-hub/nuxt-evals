import type { CheckSource } from "#shared/rubric"

/** The folders above a file, `app`, `app/pages`, so the file tree can open down to it. */
export const parentFolders = (path: string) => path.split("/").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("/"))

/** The lines a source names, as the file viewer's selection. */
export const selectedLines = (source?: CheckSource) => source?.line ? { start: source.line, end: Math.max(source.endLine ?? source.line, source.line) } : undefined

/**
 * Scrolls the file viewer in `container` to `line`. The viewer renders into a shadow root after the file loads, so this
 * waits for the line to appear, for up to two seconds.
 */
export function scrollToLine(container: HTMLElement | undefined, line: number) {
  const started = performance.now()
  const step = () => {
    if (!container) return
    for (const host of container.querySelectorAll("*")) {
      const row = host.shadowRoot?.querySelector<HTMLElement>(`[data-line="${line}"]:not([data-line-type="change-deletion"])`)
      // Scroll the viewer only: scrollIntoView would also scroll the page under the site header.
      if (row) {
        container.scrollTop += row.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientHeight / 3
        return
      }
    }
    if (performance.now() - started < 2000) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

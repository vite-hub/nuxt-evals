import { isFocusedElementEditable, onKeyStroke } from "@vueuse/core"

/** Ctrl+Z / ⌘Z, Ctrl+Shift+Z, Ctrl+Y. */
const undoKeys = (event: KeyboardEvent) => (event.ctrlKey || event.metaKey) && !event.altKey && /^[yz]$/i.test(event.key)

/**
 * Ctrl+Z (⌘Z) undoes, Ctrl+Shift+Z and Ctrl+Y redo, while the component that calls this is mounted. Inside a text
 * field and in an open dialog the keys belong to them: a field undoes its own typing.
 */
export function useUndoShortcuts(undo: () => void, redo: () => void) {
  onKeyStroke(undoKeys, (event) => {
    if (isFocusedElementEditable() || document.querySelector("dialog[open]")) return
    event.preventDefault()
    if (event.key.toLowerCase() === "z" && !event.shiftKey) undo()
    else redo()
  }, { target: document })
}

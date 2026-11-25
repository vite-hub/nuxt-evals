import { computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

/** Opens a URL dialog (see `useQueryDialog`) by its key, keeping the rest of the address. */
export function useOpenDialog<Key extends string>() {
  const route = useRoute()
  const router = useRouter()
  return (key: Key, value: string) => void router.push({ query: { ...route.query, [key]: value }, hash: route.hash })
}

/**
 * A dialog whose open state lives in the URL (`?plan=123`), so the browser's Back closes it instead of leaving the
 * page behind it, as people expect on a phone. Closing it goes back when opening it added the history entry, and
 * replaces the URL otherwise (a link that opened with the dialog already in it).
 */
export function useQueryDialog(key: string) {
  const route = useRoute()
  const router = useRouter()
  const open = useOpenDialog()
  const current = computed(() => typeof route.query[key] === "string" ? route.query[key] : undefined)
  // Closing twice before the URL changes (a confirm that closes, then the dialog's own close event) closes once.
  let closing = false
  watch(current, () => (closing = false))
  const withoutKey = () => {
    const { [key]: _closed, ...query } = route.query
    return { query, hash: route.hash }
  }
  return {
    /** What the dialog is open for, such as a recipe id, or undefined when it is closed. */
    current,
    open: (to: string) => open(key, to),
    close() {
      if (!current.value || closing) return
      closing = true
      const back = window.history.state?.back
      if (typeof back === "string" && back === router.resolve(withoutKey()).fullPath) router.back()
      else void router.replace(withoutKey())
    },
  }
}

import { createGlobalState, useIntervalFn } from "@vueuse/core"
import { ref, shallowRef } from "vue"
import { useRecipes } from "./recipes"

/**
 * New versions, through the service worker (build/sw.js). A new version installs in the background and waits; the page
 * shows a banner and updates only when the user says so, never in the middle of their work. Another tab that accepted
 * an update first gets a banner asking to reload instead.
 */
export const useAppUpdate = createGlobalState(() => {
  const waiting = shallowRef<ServiceWorker>()
  const updatedElsewhere = ref(false)
  /** True while this page reloads into the new version. Pages with unsaved work let it go: their drafts are kept. */
  const applying = ref(false)
  let registration: ServiceWorkerRegistration | undefined

  function watchInstall(worker: ServiceWorker) {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) waiting.value = worker
    })
  }

  async function register() {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    // A browser can refuse service workers (private modes, policies): the app then works online only.
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.warn("No offline support", error)
      return undefined
    })
    if (!registration) return
    if (registration.waiting && navigator.serviceWorker.controller) waiting.value = registration.waiting
    if (registration.installing) watchInstall(registration.installing)
    registration.addEventListener("updatefound", () => registration?.installing && watchInstall(registration.installing))
    // The first worker taking over a page that had none is the app going offline-ready, not a new version.
    let controlled = Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (applying.value) window.location.reload()
      else if (controlled) updatedElsewhere.value = true
      // Recipes opened before the worker took over didn't go through it: hand it their files to keep offline.
      else navigator.serviceWorker.controller?.postMessage({ type: "cache", urls: useRecipes().loadedFiles() })
      controlled = true
    })
  }

  /** Looks for a new version. Runs every 30 seconds and after each navigation. */
  function check() {
    void registration?.update().catch((error: unknown) => {
      // Offline, or the server is down: the next check tries again.
      console.warn("Update check failed", error)
    })
  }
  useIntervalFn(check, 30_000)

  return {
    waiting,
    updatedElsewhere,
    applying,
    register,
    check,
    /** Switches to the waiting version; the page reloads once it takes over. */
    apply() {
      applying.value = true
      waiting.value?.postMessage({ type: "skip-waiting" })
    },
  }
})

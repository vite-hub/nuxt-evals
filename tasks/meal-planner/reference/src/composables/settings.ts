import { createGlobalState, useColorMode } from "@vueuse/core"
import { isRecord, parseSettings } from "../domain/schema"
import type { Settings } from "../domain/types"
import { modelField } from "./model-field"
import { useVersionedStorage } from "./storage"

/** index.html reads this key before the app loads, so dark mode paints dark from the first frame. */
export const settingsKey = "meal-planner:settings"

export const useSettings = createGlobalState(() => {
  const settings = useVersionedStorage<Settings>(settingsKey, {
    version: 2,
    parse: parseSettings,
    // Version 2 added the language; until a user picks one, the browser's applies.
    migrate: { 2: data => isRecord(data) ? { ...data, language: null } : data },
    initial: { units: "metric", colorMode: "auto", language: null },
  })
  const colorMode = modelField(settings, "colorMode")
  // Puts `light` or `dark` on <html>, following the system while the choice is "auto".
  useColorMode({ storageRef: colorMode })
  return { settings, units: modelField(settings, "units"), colorMode, language: modelField(settings, "language") }
})

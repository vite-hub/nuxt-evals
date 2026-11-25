import { toDateKey } from "../domain/dates"
import { maxImportBytes, parseExport, toExport, type UserData } from "../domain/schema"
import { messages } from "../i18n"
import { useHousehold } from "./household"
import { usePantry } from "./pantry"
import { usePlan } from "./plan"
import { useRecipes } from "./recipes"
import { useSettings } from "./settings"
import { useShopping } from "./shopping"
import { notify } from "./toasts"

/** Export and import of everything that belongs to the user. The built-in recipes stay out: every copy of the app has them. */
export function useUserData() {
  const { plan } = usePlan()
  const { people } = useHousehold()
  const { custom } = useRecipes()
  const { shopping } = useShopping()
  const { pantry } = usePantry()
  const { settings } = useSettings()

  function exportData() {
    const data: UserData = { plan: plan.value, people: people.value, recipes: custom.value, shopping: shopping.value, pantry: pantry.value, settings: settings.value }
    const url = URL.createObjectURL(new Blob([toExport(data)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `meal-planner-${toDateKey(new Date())}.json`
    link.click()
    // The download starts after this task; revoking the URL right away can cancel it.
    setTimeout(() => URL.revokeObjectURL(url))
    notify(messages.value.settings.exported)
  }

  const hasData = () => plan.value.length > 0 || people.value.length > 0 || custom.value.length > 0 || Object.keys(pantry.value).length > 0
    || Object.values(shopping.value.ticked).some(keys => keys.length > 0)

  /**
   * Reads an export and replaces the user's data with it, after asking when there is data to lose. Nothing changes when
   * the file is wrong.
   */
  async function importData(file: File) {
    const t = messages.value.settings
    if (file.size > maxImportBytes) return notify(t.tooBig(maxImportBytes / 1024 / 1024), "error")
    const result = parseExport(await file.text())
    if (!result.ok) return notify(t.importErrors[result.error], "error")
    const { data } = result
    if (hasData() && !window.confirm(t.replaceConfirm(data.recipes.length, data.plan.length))) return
    plan.value = data.plan
    people.value = data.people
    custom.value = data.recipes
    shopping.value = data.shopping
    pantry.value = data.pantry
    settings.value = data.settings
    notify(t.imported)
  }

  return { exportData, importData }
}

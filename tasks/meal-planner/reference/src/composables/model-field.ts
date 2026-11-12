import { computed, type WritableComputedRef } from "vue"

/**
 * One field of an object held in a ref (a `defineModel`, stored settings), for `v-model`. Writing it sets a new object,
 * so the owner sees the change and nothing mutates its value in place.
 */
export function modelField<T extends object, K extends keyof T>(model: { value: T }, key: K): WritableComputedRef<T[K]> {
  return computed({
    get: () => model.value[key],
    set: value => (model.value = { ...model.value, [key]: value }),
  })
}

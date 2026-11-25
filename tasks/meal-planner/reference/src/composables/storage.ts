import { type RemovableRef, type Serializer, useStorage } from "@vueuse/core"
import { type MaybeRefOrGetter, ref, toRaw } from "vue"
import { isRecord, parseJson } from "../domain/schema"
import { messages } from "../i18n"
import { notify } from "./toasts"

/** True once the browser refused to store something (storage full, or blocked). The app then runs from memory. */
export const storageFailed = ref(false)
/** True once storage holds data a newer version of the app wrote. This tab then never writes over it, and asks to reload. */
export const storageOutdated = ref(false)

/** Thrown, and caught by useStorage, to keep an old tab from writing over data of a newer version. */
class OutdatedError extends Error {}

export interface StoredShape<T> {
  version: number
  /** Checks data of the current version. Null when it has the wrong shape. */
  parse: (data: unknown) => T | null
  /** Upgrades older data one version at a time: `migrate[2]` turns version 1 data into version 2 data. */
  migrate?: Record<number, (data: unknown) => unknown>
  initial: T
}

type Read<T> = { data: T } | { unreadable: true } | { newer: true }

function readEnvelope<T>(raw: string, shape: StoredShape<T>): Read<T> {
  let envelope: unknown = null
  try {
    envelope = parseJson(raw)
  }
  catch {
    // Not JSON: unreadable, like any other garbage.
  }
  if (!isRecord(envelope) || typeof envelope.version !== "number" || !Number.isInteger(envelope.version)) return { unreadable: true }
  if (envelope.version > shape.version) return { newer: true }
  let data = envelope.data
  for (let version = envelope.version + 1; version <= shape.version; version++) {
    const step = shape.migrate?.[version]
    if (!step) return { unreadable: true }
    data = step(data)
  }
  const parsed = shape.parse(data)
  return parsed === null ? { unreadable: true } : { data: parsed }
}

/**
 * State kept in localStorage as `{ version, data }`, checked whenever it is read: on load and when another tab changes
 * it (useStorage listens to the `storage` event). Older versions are migrated; data of the wrong shape is replaced by
 * `initial`, and the user is told; data of a newer version is left alone.
 */
export function useVersionedStorage<T>(key: MaybeRefOrGetter<string>, shape: StoredShape<T>): RemovableRef<T> {
  let unreadable = false
  const serializer: Serializer<T> = {
    read(raw) {
      const result = readEnvelope(raw, shape)
      if ("data" in result) return result.data
      if ("newer" in result) {
        storageOutdated.value = true
        throw new OutdatedError(`${String(key)} was written by a newer version`)
      }
      unreadable = true
      return shape.initial
    },
    write(data) {
      if (storageOutdated.value) throw new OutdatedError("A newer version owns the stored data")
      return JSON.stringify({ version: shape.version, data })
    },
  }
  // writeDefaults: false, so merely opening the app (a shared link, say) writes nothing until the user changes something.
  const state = useStorage(key, shape.initial, undefined, {
    serializer,
    writeDefaults: false,
    onError(error) {
      if (error instanceof OutdatedError) return
      console.error("Couldn't store", error)
      storageFailed.value = true
    },
  })
  if (unreadable) {
    notify(messages.value.app.storageReset, "error")
    // A new copy is a change, so useStorage writes the fresh value over the unreadable one.
    state.value = structuredClone(toRaw(state.value))
  }
  return state
}

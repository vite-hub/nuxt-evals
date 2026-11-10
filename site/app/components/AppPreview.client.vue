<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { DeviceFrame, type DeviceFrameSize } from "@vite-hub/ui/device-frame"
import type { ViteHubWebContainer, WebContainerStage, WebContainerStep } from "vite-hub/web-container"

// Runs the app in this tab, inside a WebContainer: its node_modules from a snapshot (or npm install when there is none),
// the local stand-ins for the paid services, the database migrations, then nuxt dev.
// `snapshot` is the manifest `evals push` uploads: the node_modules, installed as a WebContainer would. npm can't install
// these apps from a deployed origin ("Failed to pre-resolve dependencies"), and a snapshot boots in seconds.
const props = defineProps<{ source: string, snapshot?: string, label: string }>()

// The values of the fixture's .env: the stand-ins in services/ answer on port 4799.
const env = {
  NUXT_RATES_API_URL: "http://127.0.0.1:4799",
  NUXT_RATES_API_KEY: "dev-rates-key",
  NUXT_MAILER_URL: "http://127.0.0.1:4799",
  // WebContainer's wasm SQLite can't open a file below a folder, such as ViteHub's .vitehub/data/database/sqlite.db.
  // Apps that read DATABASE_URL get a file at the root instead.
  DATABASE_URL: "file:preview.db",
}
const stageLabels: Partial<Record<WebContainerStage, string>> = {
  booting: "Start the container",
  mounting: "Copy the files",
  installing: "Install packages",
  starting: "Start nuxt dev",
  ready: "Ready",
}

const container = shallowRef<ViteHubWebContainer>()

// Device mode is shared by every preview and kept across visits.
const deviceKey = "nuxt-evals:preview-device"
function storedDevice(): DeviceFrameSize | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(deviceKey) ?? "null")
    return value && typeof value === "object" && "width" in value ? value as DeviceFrameSize : undefined
  }
  catch {
    return undefined
  }
}
const device = ref<DeviceFrameSize>(storedDevice() ?? { on: false, id: "iphone", width: 393, height: 852, zoom: null })
watch(device, value => localStorage.setItem(deviceKey, JSON.stringify(value)))
const state = ref<"idle" | "running" | "ready" | "error">("idle")
const steps = ref<readonly WebContainerStep[]>([])
const error = ref("")
const url = ref("")
const lines = ref<string[]>([])
const frame = ref<HTMLIFrameElement>()
const now = ref(performance.now())
let clock: ReturnType<typeof setInterval> | undefined

const shownSteps = computed(() => steps.value.filter(step => stageLabels[step.stage]))
const tail = computed(() => lines.value.slice(-12).join("\n"))

function seconds(ms: number): string {
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`
}

function log(stream: ReadableStream<string>) {
  void stream.pipeTo(new WritableStream({
    write(chunk) {
      // Terminal colors and cursor moves mean nothing here.
      const text = chunk.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "\n")
      const next = [...lines.value, ...text.split("\n").filter(line => line.trim())]
      lines.value = next.slice(-200)
    },
  })).catch(() => undefined)
}

/**
 * WebContainer's wasm SQLite keeps a database inside the process that opens it, so `vitehub db migrate` (Drizzle Kit,
 * which can't load that build here anyway) would migrate a database the dev server never sees. For apps with ViteHub's
 * migrations, this Nitro plugin applies them inside the dev server instead. It is added to the preview only.
 */
const migratePlugin = `import { existsSync, readdirSync, readFileSync } from "node:fs"

export default async function previewMigrate() {
  const dir = "server/databases/migrations"
  if (!existsSync(dir)) return
  try {
    const { sql } = await import("drizzle-orm")
    const { db } = await import("vite-hub/database/drizzle")
    for (const file of readdirSync(dir).filter(name => name.endsWith(".sql")).sort()) {
      for (const statement of readFileSync(dir + "/" + file, "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) await db.run(sql.raw(statement))
      }
    }
  }
  catch (error) {
    console.error("[preview] migrations not applied", error)
  }
}
`

/**
 * One-line fixes for packages that real Node runs but WebContainer's module loader doesn't: @simplewebauthn/server 13
 * (Better Auth's passkey plugin) reaches isoBase64URL through a circular `export *` in one file, where its siblings
 * import it directly.
 */
const fixups = [
  { path: "node_modules/@simplewebauthn/server/esm/helpers/iso/isoCrypto/verifyOKP.js", from: "'../../index.js'", to: "'../index.js'" },
]

/** The fixture's package.json without the pnpm-only fields and the postinstall, which wedges later spawns here. */
function forNpm(text: string): string {
  const manifest = JSON.parse(text) as { packageManager?: string, scripts?: Record<string, string> }
  delete manifest.packageManager
  delete manifest.scripts?.postinstall
  return `${JSON.stringify(manifest, null, 2)}\n`
}

async function start() {
  const { bootWebContainer, checkWebContainerSupport, fetchSnapshot } = await import("vite-hub/web-container")
  const support = checkWebContainerSupport()
  if (!support.supported) {
    state.value = "error"
    error.value = `This browser can't run the preview: ${support.reason}`
    return
  }
  state.value = "running"
  error.value = ""
  lines.value = []
  clock = setInterval(() => (now.value = performance.now()), 500)
  try {
    const { files } = await $fetch<{ files: Record<string, string> }>(props.source)
    if (files["package.json"]) files["package.json"] = forNpm(files["package.json"])
    if (Object.keys(files).some(path => path.startsWith("server/databases/migrations/"))) files["server/plugins/zz-preview-migrate.ts"] = migratePlugin
    // The apps were installed with pnpm, which warns about a peer version conflict; npm stops on it
    // (better-auth and @better-auth/passkey pin two patch releases of better-call, for one).
    files[".npmrc"] = `${files[".npmrc"] ?? ""}\nlegacy-peer-deps=true\n`
    const manifest = props.snapshot ? await $fetch<{ sha256: string, parts: number }>(props.snapshot).catch(() => undefined) : undefined
    const base = props.snapshot?.replace(/manifest\.json$/, "")
    const snapshot = manifest && base
      ? fetchSnapshot(Array.from({ length: manifest.parts }, (_, index) => `${base}${manifest.sha256}.${index}.bin`), { cache: `nuxt-evals-preview:${base}`, sha256: manifest.sha256 })
      : undefined
    const booted = await bootWebContainer({ files, port: 3000, ...(snapshot ? { snapshot } : {}), onStatus: status => (steps.value = status.steps) })
    container.value = booted
    if (!snapshot) {
      const install = await booted.run("install")
      log(install.output)
      const code = await install.exit
      if (code !== 0) throw new Error(`npm install exited with ${code}.`)
    }
    for (const fix of fixups) {
      const text = await booted.fs.readFile(fix.path, "utf-8").catch(() => undefined)
      if (text?.includes(fix.from)) await booted.fs.writeFile(fix.path, text.replace(fix.from, fix.to))
    }
    // The stand-ins listen on PORT. Every run gets PORT=3000, and a run with its own env.PORT becomes the preview,
    // so the port is set inside the process.
    if (files["services/fake-services.mjs"]) {
      log((await booted.run(["node", "-e", "process.env.PORT = '4799'; import('./services/fake-services.mjs')"])).output)
    }
    log((await booted.run("dev", { env })).output)
    url.value = (await booted.preview.ready).url
    state.value = "ready"
  }
  catch (cause) {
    state.value = "error"
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    clearInterval(clock)
  }
}

function stop() {
  container.value?.teardown()
  container.value = undefined
  clearInterval(clock)
  state.value = "idle"
  steps.value = []
  url.value = ""
}

function reload() {
  if (frame.value) frame.value.src = url.value
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="state === 'ready'"
      class="flex h-9 flex-none items-center gap-1 border-b border-default px-3 text-xs"
    >
      <span class="truncate text-highlighted">{{ label }}</span>
      <span class="truncate text-dimmed">nuxt dev</span>
      <UButton
        class="ml-auto"
        icon="i-lucide-smartphone"
        size="xs"
        color="neutral"
        :variant="device.on ? 'soft' : 'ghost'"
        :aria-pressed="device.on"
        aria-label="Device mode"
        @click="device = { ...device, on: !device.on }"
      />
      <UButton
        icon="i-lucide-rotate-cw"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Reload the preview"
        @click="reload"
      />
      <UButton
        :to="url"
        target="_blank"
        icon="i-lucide-external-link"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Open the preview in a new tab"
      />
      <UButton
        icon="i-lucide-square"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Stop the preview"
        @click="stop"
      />
    </div>

    <DeviceFrame
      v-if="state === 'ready'"
      v-model="device"
    >
      <iframe
        ref="frame"
        :src="url"
        :title="`Preview of ${label}`"
        class="min-h-0 flex-1 bg-white"
        allow="cross-origin-isolated"
      />
    </DeviceFrame>

    <div
      v-else
      class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8"
    >
      <div class="w-full max-w-sm">
        <template v-if="state === 'idle'">
          <h3 class="text-sm font-medium text-highlighted">
            Run {{ label }} in this tab
          </h3>
          <p class="mt-1.5 text-[13px] leading-relaxed text-muted text-pretty">
            Installs the packages and starts <code class="font-mono text-xs">nuxt dev</code> in a WebContainer, here in your browser. The first start takes a few minutes.
          </p>
          <UButton
            class="mt-4"
            icon="i-lucide-play"
            size="sm"
            color="neutral"
            label="Start preview"
            @click="start"
          />
        </template>

        <template v-else>
          <h3 class="text-sm font-medium text-highlighted">
            {{ state === 'error' ? "The preview stopped" : "Starting the preview" }}
          </h3>
          <ol class="mt-3 flex flex-col gap-1 text-[13px]">
            <li
              v-for="step in shownSteps"
              :key="step.stage"
              class="flex items-center gap-2"
            >
              <UIcon
                :name="step.ms === undefined ? (state === 'error' ? 'i-lucide-x' : 'i-lucide-loader-circle') : 'i-lucide-check'"
                class="size-3.5 flex-none"
                :class="step.ms === undefined ? (state === 'error' ? 'text-error' : 'animate-spin text-muted') : 'text-muted'"
              />
              <span :class="step.ms === undefined ? 'text-highlighted' : 'text-muted'">{{ stageLabels[step.stage] }}</span>
              <span class="ml-auto tabular-nums text-dimmed">{{ seconds(step.ms ?? now - step.startedAt) }}</span>
            </li>
          </ol>
          <p
            v-if="error"
            class="mt-3 text-[13px] text-error"
          >
            {{ error }}
          </p>
          <pre
            v-if="tail"
            class="mt-3 max-h-48 overflow-hidden whitespace-pre-wrap break-all rounded-sm bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted"
          >{{ tail }}</pre>
          <div class="mt-4 flex gap-2">
            <UButton
              v-if="state === 'error'"
              size="sm"
              color="neutral"
              label="Try again"
              @click="stop(); start()"
            />
            <UButton
              v-else
              size="sm"
              color="neutral"
              variant="ghost"
              label="Stop"
              @click="stop"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

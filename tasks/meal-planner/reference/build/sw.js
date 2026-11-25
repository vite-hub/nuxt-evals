// The service worker. build/service-worker.ts fills in `manifest` for each build: the version, the app's files to keep
// offline, and the recipe shards of this build. Recipe shards are cached as they are opened, not ahead: all of them
// together are as big as the data. Nothing here takes over on its own: a new version waits until the page asks.
/* global self, caches, fetch, URL, Response */
const manifest = self.__MANIFEST
const cacheName = `meal-planner-${manifest.version}`
const scope = new URL(self.registration.scope)
const absolute = path => new URL(path, scope).href
const precache = manifest.precache.map(absolute)
const shards = new Set(manifest.shards.map(absolute))
const shell = absolute("index.html")

/** A response this or an older version already cached. Hashed files with the same name have the same content. */
async function cached(url) {
  for (const name of await caches.keys()) {
    if (!name.startsWith("meal-planner-")) continue
    const response = await (await caches.open(name)).match(url, { ignoreVary: true })
    if (response) return response
  }
  return undefined
}

self.oninstall = (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    await Promise.all(precache.map(async (url) => {
      // index.html has no hash in its name, so it always comes from the network.
      const reused = url === shell ? undefined : await cached(url)
      const response = reused ?? await fetch(url, { cache: "no-cache" })
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      await cache.put(url, response)
    }))
    // Recipes opened under the old version stay offline when their shard didn't change.
    for (const name of await caches.keys()) {
      if (name === cacheName || !name.startsWith("meal-planner-")) continue
      const old = await caches.open(name)
      for (const request of await old.keys()) {
        if (shards.has(request.url)) await cache.put(request, await old.match(request))
      }
    }
  })())
}

self.onmessage = (event) => {
  if (event.data?.type === "skip-waiting") self.skipWaiting()
  // Recipes the page opened before this worker controlled it (the first visit) didn't pass through it: fetch them now,
  // so they are offline too.
  if (event.data?.type === "cache" && Array.isArray(event.data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(cacheName)
      for (const url of event.data.urls.map(absolute).filter(url => shards.has(url))) {
        if (await cache.match(url, { ignoreVary: true })) continue
        const response = await fetch(url)
        if (response.ok) await cache.put(url, response)
      }
    })())
  }
}

// Once active, only this version's cache is left.
self.onactivate = (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== cacheName && name.startsWith("meal-planner-")) await caches.delete(name)
    }
    await self.clients.claim()
  })())
}

self.onfetch = (event) => {
  const { request } = event
  if (request.method !== "GET" || !request.url.startsWith(scope.origin)) return
  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    // Every page is the app: its HTML comes from this version's cache, so it matches the scripts this version has.
    if (request.mode === "navigate") return await cache.match(shell) ?? fetch(request)
    // ignoreVary: servers send `Vary: Origin`, and module scripts carry an Origin header that the install's fetch
    // didn't, so a strict match would miss every script offline. These files never change under the same name.
    const hit = await cache.match(request, { ignoreVary: true })
    if (hit) return hit
    const response = await fetch(request)
    if (response.ok && shards.has(request.url)) await cache.put(request, response.clone())
    return response
  })())
}

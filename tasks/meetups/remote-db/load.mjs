// The loader hook behind register.mjs: wraps libSQL's local client so each query waits a few milliseconds before and
// after it runs, as a request to a remote database would. It patches the built server's copy (`_libs/_libsql/client.mjs`)
// and the package itself, by appending code to the module that holds the `Sqlite3Client` class.
const delay = Number(process.env.REMOTE_DB_DELAY_MS ?? 5)
const patch = `
;{
  const wait = () => new Promise(resolve => setTimeout(resolve, ${delay}))
  for (const name of ["execute", "batch", "executeMultiple", "migrate"]) {
    const original = Sqlite3Client.prototype[name]
    if (typeof original !== "function") continue
    Sqlite3Client.prototype[name] = async function (...args) {
      await wait()
      const result = await original.apply(this, args)
      await wait()
      return result
    }
  }
}
`

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  if (!/\/_libsql\/client\.mjs$|\/@libsql\/client\/lib-esm\/sqlite3\.js$/.test(url) || !result.source) return result
  const source = String(result.source)
  // `export class Sqlite3Client` in the package, `var Sqlite3Client = class` or `class Sqlite3Client` in a bundle.
  if (!/\bSqlite3Client\b/.test(source)) return result
  console.error(`[remote-db] ${delay} ms around each libSQL query: ${url}`)
  return { ...result, source: source + patch, shortCircuit: true }
}

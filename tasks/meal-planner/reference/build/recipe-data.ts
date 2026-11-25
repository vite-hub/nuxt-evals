// Turns data/ into what the app loads: a column index of every recipe for the list (small enough to parse without
// freezing a phone), the full recipes in shards of `shardSize` ids that load on demand, and the ingredients. Every
// file's name carries a hash of its content, so a browser or the service worker fetches it again only when it changed.
// The app reads the names from `virtual:recipe-data`. In dev the files are served from memory.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Plugin } from "vite"
import { buildIndex } from "../src/domain/recipe-index.ts"
import { parseIngredient, parseRecipe, validItems } from "../src/domain/schema.ts"

export const shardSize = 100
const virtualId = "virtual:recipe-data"

interface DataFiles {
  /** File name (under the base URL) → content. */
  files: Map<string, string>
  module: string
}

function hashed(name: string, content: string, files: Map<string, string>): string {
  const fileName = `data/${name}.${createHash("sha256").update(content).digest("hex").slice(0, 10)}.json`
  files.set(fileName, content)
  return fileName
}

function prepare(root: string): DataFiles {
  const read = (name: string) => JSON.parse(readFileSync(join(root, "data", name), "utf8")) as unknown
  const recipes = validItems(read("recipes.json"), parseRecipe)
  const ingredients = validItems(read("ingredients.json"), parseIngredient)
  if (!recipes?.length || !ingredients?.length) throw new Error("data/recipes.json or data/ingredients.json has no valid items.")
  const files = new Map<string, string>()
  const shards: Record<number, string> = {}
  const byShard = Map.groupBy(recipes, recipe => Math.floor(Number(recipe.id) / shardSize))
  for (const [shard, list] of byShard) shards[shard] = hashed(`recipes-${shard}`, JSON.stringify(list), files)
  const index = hashed("index", JSON.stringify(buildIndex(recipes)), files)
  const catalog = hashed("ingredients", JSON.stringify(ingredients), files)
  const module = [
    `export const indexFile = ${JSON.stringify(index)}`,
    `export const ingredientsFile = ${JSON.stringify(catalog)}`,
    `export const shardSize = ${shardSize}`,
    `export const shardFiles = ${JSON.stringify(shards)}`,
  ].join("\n")
  return { files, module }
}

export function recipeData(): Plugin {
  let data: DataFiles | undefined
  let root = process.cwd()
  const load = () => (data ??= prepare(root))
  return {
    name: "recipe-data",
    configResolved(config) {
      root = config.root
    },
    resolveId: id => id === virtualId ? `\0${virtualId}` : undefined,
    load: id => id === `\0${virtualId}` ? load().module : undefined,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const content = load().files.get(decodeURIComponent(request.url ?? "").replace(/^\//, "").split("?")[0] ?? "")
        if (content === undefined) return next()
        response.setHeader("content-type", "application/json")
        response.end(content)
      })
    },
    generateBundle() {
      for (const [fileName, source] of load().files) this.emitFile({ type: "asset", fileName, source })
    },
  }
}

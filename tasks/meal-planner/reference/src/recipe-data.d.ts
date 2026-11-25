declare module "virtual:recipe-data" {
  /** File names under the base URL, from build/recipe-data.ts. */
  export const indexFile: string
  export const ingredientsFile: string
  export const shardSize: number
  /** Shard number (`Math.floor(id / shardSize)`) → file name. */
  export const shardFiles: Record<number, string>
}

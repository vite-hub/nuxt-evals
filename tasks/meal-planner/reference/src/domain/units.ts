import { roundAmount } from "./format.ts"
import type { Ingredient, UnitSystem } from "./types.ts"

export const massUnits = { g: 1, kg: 1000, oz: 28.35, lb: 453.59 } as const
/** US measures as data/README.md gives them, in milliliters. */
export const volumeUnits = { "ml": 1, "l": 1000, "tsp": 4.93, "tbsp": 14.79, "fl oz": 29.57, "cup": 236.59 } as const
export const countUnits = ["piece", "clove", "can", "pinch"] as const

export type MassUnit = keyof typeof massUnits
export type VolumeUnit = keyof typeof volumeUnits
export type CountUnit = (typeof countUnits)[number]
export type Unit = MassUnit | VolumeUnit | CountUnit

export const units: readonly Unit[] = [...Object.keys(massUnits), ...Object.keys(volumeUnits), ...countUnits] as Unit[]

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (units as readonly string[]).includes(value)
}

export type Dimension = "mass" | "volume" | CountUnit

/** An amount in its dimension's base unit: grams, milliliters, or the count itself. */
export interface BaseAmount {
  dimension: Dimension
  value: number
  /** Volumes measured with spoons stay in spoons in metric too, as metric cookbooks write them. */
  spoons?: boolean
}

export function toBase(quantity: number, unit: Unit): BaseAmount {
  if (unit in massUnits) return { dimension: "mass", value: quantity * massUnits[unit as MassUnit] }
  if (unit in volumeUnits) return { dimension: "volume", value: quantity * volumeUnits[unit as VolumeUnit], spoons: unit === "tsp" || unit === "tbsp" }
  return { dimension: unit as CountUnit, value: quantity }
}

export interface Amount {
  value: number
  unit: Unit
}

/** Units in the order a cook moves up through them, each with its size in base units and where the next one takes over. */
type Ladder = readonly (readonly [unit: Unit, size: number, upTo: number])[]
const ladders = {
  metricMass: [["g", 1, 1000], ["kg", 1000, Infinity]],
  usMass: [["oz", massUnits.oz, 16], ["lb", massUnits.lb, Infinity]],
  // US cooks measure up to ¼ cup with spoons; metric cooks keep spoons for what a recipe measured with spoons.
  usVolume: [["tsp", volumeUnits.tsp, 3], ["tbsp", volumeUnits.tbsp, 4], ["cup", volumeUnits.cup, Infinity]],
  metricSpoons: [["tsp", volumeUnits.tsp, 3], ["tbsp", volumeUnits.tbsp, 6], ["ml", 1, 1000], ["l", 1000, Infinity]],
  metricVolume: [["ml", 1, 1000], ["l", 1000, Infinity]],
} satisfies Record<string, Ladder>

/**
 * The unit a cook would read a base amount in, in the chosen system. The amount is rounded the way it will be shown
 * before a unit is picked, so 999.6 g reads 1 kg, not 1,000 g, and 14.7 ml reads 1 tbsp, not 3 tsp.
 */
export function displayAmount(base: BaseAmount, system: UnitSystem): Amount {
  const { dimension, value } = base
  if (dimension !== "mass" && dimension !== "volume") return { value, unit: dimension }
  const ladder: Ladder = dimension === "mass"
    ? system === "us" ? ladders.usMass : ladders.metricMass
    : system === "us" ? ladders.usVolume : base.spoons ? ladders.metricSpoons : ladders.metricVolume
  const amounts = ladder.map(([unit, size, upTo]) => ({ value: value / size, unit, upTo }))
  // The last rung reaches Infinity, so one always fits.
  const { upTo: _upTo, ...amount } = amounts.find(candidate => roundAmount(candidate) < candidate.upTo) ?? amounts.at(-1)!
  return amount
}

/** Sums base amounts per dimension. Mass and volume can't be added without a density, so they stay apart. */
export function addBaseAmounts(amounts: BaseAmount[]): BaseAmount[] {
  const sums = new Map<Dimension, BaseAmount>()
  for (const amount of amounts) {
    const sum = sums.get(amount.dimension)
    sums.set(amount.dimension, sum
      ? { dimension: amount.dimension, value: sum.value + amount.value, spoons: Boolean(sum.spoons && amount.spoons) }
      : { ...amount })
  }
  const order: Dimension[] = ["mass", "volume", ...countUnits]
  return [...sums.values()].sort((a, b) => order.indexOf(a.dimension) - order.indexOf(b.dimension))
}

/** What the data knows about an ingredient's weight. */
export type Weights = Pick<Ingredient, "gramsPerCup" | "gramsPerPiece">

/** An amount in grams, through the density or the piece weight, or null when the data doesn't say. Pinches never weigh. */
export function toGrams({ dimension, value }: BaseAmount, weights: Weights): number | null {
  if (dimension === "mass") return value
  if (dimension === "volume") return weights.gramsPerCup ? value / volumeUnits.cup * weights.gramsPerCup : null
  if (dimension === "pinch") return null
  return weights.gramsPerPiece ? value * weights.gramsPerPiece : null
}

/** An amount turned into another dimension, through grams when the dimensions differ, or null when it can't be. */
export function convertTo(amount: BaseAmount, dimension: Dimension, weights: Weights): number | null {
  if (amount.dimension === dimension) return amount.value
  const grams = toGrams(amount, weights)
  if (grams === null) return null
  if (dimension === "mass") return grams
  const one = toGrams({ dimension, value: 1 }, weights)
  return one ? grams / one : null
}

/**
 * Adds up amounts of one ingredient. Amounts of one kind add directly. When there are several kinds, every kind the
 * data can weigh joins one total in grams; a kind it can't weigh (no density, no piece weight) stays apart.
 */
export function combineAmounts(amounts: BaseAmount[], weights: Weights): BaseAmount[] {
  const sums = addBaseAmounts(amounts)
  if (sums.length < 2) return sums
  const grams = sums.map(amount => toGrams(amount, weights))
  const weighed = grams.filter((value): value is number => value !== null)
  if (weighed.length < 2) return sums
  const total: BaseAmount = { dimension: "mass", value: weighed.reduce((sum, value) => sum + value, 0) }
  return [total, ...sums.filter((_, at) => grams[at] === null)]
}

/** How much of `unit` a base amount (grams, milliliters, or a count) makes. */
export function inUnit(value: number, unit: Unit): number {
  if (unit in massUnits) return value / massUnits[unit as MassUnit]
  if (unit in volumeUnits) return value / volumeUnits[unit as VolumeUnit]
  return value
}

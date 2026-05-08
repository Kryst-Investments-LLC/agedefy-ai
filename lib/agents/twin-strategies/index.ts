/**
 * Strategy registry for the digital-twin runner.
 *
 * Call sites pass `{ strategyId: "pbpk-1cmt" }` instead of importing
 * the implementation directly so we can swap engines at runtime
 * (e.g. promote a learned surrogate model behind a feature flag).
 */

import type { TwinSimulationStrategy } from "../digital-twin"

import { pbpkOneCompartmentStrategy } from "./pbpk-1cmt"

const REGISTRY: Record<string, TwinSimulationStrategy> = {
  "pbpk-1cmt": pbpkOneCompartmentStrategy,
}

export const DEFAULT_STRATEGY_ID = "pbpk-1cmt"

export function getTwinStrategy(id: string = DEFAULT_STRATEGY_ID): TwinSimulationStrategy {
  const impl = REGISTRY[id]
  if (!impl) throw new Error(`Unknown twin strategy: ${id}`)
  return impl
}

export function listTwinStrategies(): string[] {
  return Object.keys(REGISTRY)
}

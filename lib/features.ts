/**
 * Client-safe feature flags for demoting speculative surfaces.
 *
 * These read NEXT_PUBLIC_* env vars so they work in client components (the
 * sidebar), and they default OFF — speculative features are hidden until a
 * deploy explicitly turns them on. This keeps the core "measure → recommend →
 * track" loop front-and-centre and the frontier experiments out of the way.
 *
 * Server-only experiments (sidecars, federated-learning backend) keep their
 * existing gates in lib/env.ts; this is purely about what the nav surfaces.
 */

export type FeatureKey =
  | 'proteinDocking'
  | 'scientistSponsor'
  | 'compoundBoard'
  | 'threeDBody'

export function isFeatureEnabled(key: FeatureKey): boolean {
  switch (key) {
    case 'proteinDocking':
      return process.env.NEXT_PUBLIC_ENABLE_PROTEIN_DOCKING === 'true'
    case 'scientistSponsor':
      return process.env.NEXT_PUBLIC_ENABLE_SCIENTIST_SPONSOR === 'true'
    case 'compoundBoard':
      return process.env.NEXT_PUBLIC_ENABLE_COMPOUND_BOARD === 'true'
    case 'threeDBody':
      return process.env.NEXT_PUBLIC_ENABLE_3D_BODY === 'true'
    default:
      return false
  }
}

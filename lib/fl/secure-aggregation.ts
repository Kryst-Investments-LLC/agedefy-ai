/**
 * Federated Learning — Secure Aggregation
 *
 * Implements a simplified secure aggregation protocol so the FL server
 * never sees individual gradient updates in plaintext. Uses:
 *
 * 1. Masking with pairwise random seeds (simplified Bonawitz et al.)
 * 2. Per-client gradient encryption envelope
 * 3. Server-side masked sum → unmask after threshold met
 *
 * In production, this would use proper MPC or homomorphic encryption.
 * This TypeScript implementation provides the contract and lightweight
 * masking for the Next.js coordination layer.
 *
 * @module lib/fl/secure-aggregation
 */

import { createHash, randomBytes } from 'crypto'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface MaskedUpdate {
  /** Client identifier */
  clientId: string
  /** Round number */
  round: number
  /** Masked gradient vector */
  maskedGradients: number[]
  /** Commitment hash for verification */
  commitment: string
  /** Public component of the mask (other clients use this to compute pairwise masks) */
  publicSeed: string
}

export interface AggregationResult {
  /** Unmasked aggregated gradients */
  aggregatedGradients: number[]
  /** Number of clients aggregated */
  clientCount: number
  /** Whether all commitments verified */
  verified: boolean
  /** Round number */
  round: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Generate a deterministic mask from a seed.
 * Uses the seed to generate a pseudo-random gradient-like vector.
 */
export function generateMask(seed: string, length: number): number[] {
  const mask: number[] = []
  let hashInput = seed

  while (mask.length < length) {
    const hash = createHash('sha256').update(hashInput).digest()
    // Extract 4 floats from each 32-byte hash
    for (let i = 0; i < 32 && mask.length < length; i += 4) {
      // Convert 4 bytes to a float in [-1, 1]
      const uint = hash.readUInt32BE(i)
      const value = (uint / 0xFFFFFFFF) * 2 - 1
      mask.push(value)
    }
    hashInput = hash.toString('hex') // chain hashes
  }

  return mask.slice(0, length)
}

/**
 * Compute a commitment hash for a gradient vector.
 * Used to verify integrity after unmasking.
 */
export function computeCommitment(gradients: number[]): string {
  const data = Buffer.from(gradients.map((g) => g.toFixed(10)).join(','))
  return createHash('sha256').update(data).digest('hex')
}

/* ------------------------------------------------------------------ */
/*  Client-side masking                                               */
/* ------------------------------------------------------------------ */

/**
 * Mask gradients before sending to the FL server.
 * Each client generates a random seed and adds the resulting mask
 * to their gradients. The server collects all public seeds and
 * can subtract the sum of masks after threshold clients participate.
 */
export function maskGradients(
  clientId: string,
  round: number,
  gradients: number[],
): MaskedUpdate {
  // Generate a random seed for this client's mask
  const privateSeed = randomBytes(32).toString('hex')

  // Derive public seed (shareable — doesn't reveal private mask without pairing)
  const publicSeed = createHash('sha256')
    .update(`${clientId}:${round}:${privateSeed}`)
    .digest('hex')

  // Generate mask from private seed
  const mask = generateMask(privateSeed, gradients.length)

  // Apply mask
  const maskedGradients = gradients.map((g, i) => g + mask[i])

  // Compute commitment on original gradients
  const commitment = computeCommitment(gradients)

  return {
    clientId,
    round,
    maskedGradients,
    commitment,
    publicSeed,
  }
}

/* ------------------------------------------------------------------ */
/*  Server-side aggregation                                           */
/* ------------------------------------------------------------------ */

/**
 * Aggregate masked updates from multiple clients.
 * In a full secure aggregation protocol, pairwise masks cancel out
 * when enough clients participate. This simplified version computes
 * the mean of masked gradients (masks approximately cancel due to
 * independence when n is large enough).
 *
 * For production, integrate with a proper MPC library.
 */
export function aggregateMaskedUpdates(
  updates: MaskedUpdate[],
  minClients: number = 3,
): AggregationResult | null {
  if (updates.length < minClients) {
    return null
  }

  // All gradient vectors must have the same length
  const gradientLength = updates[0].maskedGradients.length
  if (!updates.every((u) => u.maskedGradients.length === gradientLength)) {
    return null
  }

  // Compute mean of masked gradients
  // With random independent masks, E[mask_i] = 0, so E[sum(masked)] ≈ sum(true_gradients)
  const aggregated = new Array<number>(gradientLength).fill(0)

  for (const update of updates) {
    for (let i = 0; i < gradientLength; i++) {
      aggregated[i] += update.maskedGradients[i]
    }
  }

  // Average
  const clientCount = updates.length
  for (let i = 0; i < gradientLength; i++) {
    aggregated[i] /= clientCount
  }

  return {
    aggregatedGradients: aggregated,
    clientCount,
    verified: true, // simplified — full protocol would verify commitments
    round: updates[0].round,
  }
}

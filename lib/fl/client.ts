/**
 * Federated Learning — Types & Client Adapter
 *
 * TypeScript types for the FL system and a client adapter that
 * communicates with the FL server (Flower-based Python microservice).
 * The client NEVER sends raw health data — only model gradients.
 *
 * @module lib/fl/client
 */

import { logger } from '@/lib/logger'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Feature vector for the bio-age-delta prediction model */
export interface BioAgeDeltaFeatures {
  /** Normalised biomarker values (0-1 scale) */
  biomarkers: Record<string, number>
  /** Protocol-related features */
  protocolDurationDays: number
  protocolCompoundCount: number
  /** Demographic features (already generalised) */
  ageBucket: string
  biologicalSex: string
}

/** Local training result (sent to server — NO raw data) */
export interface LocalTrainingResult {
  /** Serialised model gradients/weights (base64 or JSON) */
  gradients: string
  /** Number of local training samples used */
  localSampleSize: number
  /** Local loss after training */
  localLoss: number
  /** Differential privacy budget consumed this round */
  epsilonSpent: number
  /** Client-side model version */
  modelVersion: number
  /** Training round number */
  round: number
}

/** Server-issued training task */
export interface TrainingTask {
  /** Current round number */
  round: number
  /** Model version to train */
  modelVersion: number
  /** Serialised global model weights to start from */
  globalWeights: string
  /** Hyperparameters for this round */
  hyperparams: {
    learningRate: number
    localEpochs: number
    batchSize: number
    maxGradientNorm: number
    noiseMultiplier: number
  }
}

/** FL model prediction */
export interface FLPrediction {
  /** Predicted bio-age delta (positive = improvement) */
  predictedDelta: number
  /** Model confidence (0-1) */
  confidence: number
  /** Model version used */
  modelVersion: number
  /** Features used (for explainability) */
  topFeatures: Array<{ name: string; importance: number }>
}

/** FL server status */
export interface FLServerStatus {
  healthy: boolean
  currentRound: number
  activeClients: number
  latestModelVersion: number
  totalRoundsCompleted: number
  privacyBudgetRemaining: number
}

/* ------------------------------------------------------------------ */
/*  Client Adapter                                                    */
/* ------------------------------------------------------------------ */

const DEFAULT_FL_SERVER_URL = process.env.FL_SERVER_URL ?? 'http://localhost:8081'

/**
 * FL Client Adapter — communicates with the Flower-based FL server.
 */
export class FLClientAdapter {
  constructor(private readonly serverUrl: string = DEFAULT_FL_SERVER_URL) {}

  /**
   * Check if the FL server is healthy and accepting connections.
   */
  async getServerStatus(): Promise<FLServerStatus> {
    try {
      const res = await fetch(`${this.serverUrl}/api/status`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        return { healthy: false, currentRound: 0, activeClients: 0, latestModelVersion: 0, totalRoundsCompleted: 0, privacyBudgetRemaining: 0 }
      }
      return await res.json() as FLServerStatus
    } catch {
      logger.warn('FL server not reachable', { url: this.serverUrl })
      return { healthy: false, currentRound: 0, activeClients: 0, latestModelVersion: 0, totalRoundsCompleted: 0, privacyBudgetRemaining: 0 }
    }
  }

  /**
   * Fetch the current training task from the server.
   */
  async getTrainingTask(userId: string): Promise<TrainingTask | null> {
    try {
      const res = await fetch(`${this.serverUrl}/api/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: userId }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return null
      return await res.json() as TrainingTask
    } catch (err) {
      logger.error('Failed to fetch FL training task', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /**
   * Submit local training results (gradients only) to the FL server.
   * Raw health data NEVER leaves the client.
   */
  async submitTrainingResult(
    userId: string,
    result: LocalTrainingResult,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: userId, ...result }),
        signal: AbortSignal.timeout(30000),
      })
      return res.ok
    } catch (err) {
      logger.error('Failed to submit FL training result', {
        error: err instanceof Error ? err.message : String(err),
      })
      return false
    }
  }

  /**
   * Get prediction from the latest published FL model.
   */
  async predict(features: BioAgeDeltaFeatures): Promise<FLPrediction | null> {
    try {
      const res = await fetch(`${this.serverUrl}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return null
      return await res.json() as FLPrediction
    } catch (err) {
      logger.error('FL prediction failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /**
   * Download the latest published model weights.
   */
  async downloadModel(version?: number): Promise<{ weights: string; version: number } | null> {
    try {
      const url = version
        ? `${this.serverUrl}/api/model/${version}`
        : `${this.serverUrl}/api/model/latest`
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) return null
      return await res.json() as { weights: string; version: number }
    } catch {
      return null
    }
  }
}

/**
 * Singleton FL client adapter.
 */
export const flClient = new FLClientAdapter()

/**
 * Federated Learning — Server Configuration & Strategy
 *
 * Defines the FL server configuration, aggregation strategies,
 * and round management. The actual Flower server runs as a Python
 * microservice; this module provides the TypeScript configuration
 * layer and coordinator logic.
 *
 * @module lib/fl/server-config
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type AggregationStrategy = 'fed-avg' | 'fed-prox' | 'fed-adam'

export interface FLServerConfig {
  /** Aggregation strategy */
  strategy: AggregationStrategy
  /** Minimum clients required per round */
  minClients: number
  /** Maximum clients per round (limits load) */
  maxClients: number
  /** Total number of training rounds */
  totalRounds: number
  /** Round timeout in seconds */
  roundTimeoutSeconds: number
  /** Total differential privacy budget for entire training */
  totalEpsilonBudget: number
  /** Per-round DP budget (totalEpsilon / totalRounds) */
  perRoundEpsilon: number
  /** Model architecture identifier */
  modelArchitecture: string
  /** Task type */
  taskType: string
  /** Hyperparameters */
  hyperparams: FLHyperparams
}

export interface FLHyperparams {
  learningRate: number
  localEpochs: number
  batchSize: number
  /** Max gradient L2 norm for DP clipping */
  maxGradientNorm: number
  /** Gaussian noise multiplier for DP */
  noiseMultiplier: number
  /** FedProx proximal term weight (only for fed-prox) */
  proximalMu: number
}

export interface RoundSummary {
  round: number
  participantCount: number
  aggregatedLoss: number
  aggregatedAccuracy: number
  epsilonSpent: number
  duration: number // seconds
  status: 'completed' | 'failed' | 'timeout'
}

/* ------------------------------------------------------------------ */
/*  Default configuration                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_FL_CONFIG: FLServerConfig = {
  strategy: 'fed-avg',
  minClients: 5,
  maxClients: 100,
  totalRounds: 50,
  roundTimeoutSeconds: 300,
  totalEpsilonBudget: 8.0,
  perRoundEpsilon: 0.16, // 8.0 / 50
  modelArchitecture: 'mlp-3-64',
  taskType: 'bio-age-delta',
  hyperparams: {
    learningRate: 0.01,
    localEpochs: 3,
    batchSize: 32,
    maxGradientNorm: 1.0,
    noiseMultiplier: 1.1,
    proximalMu: 0.01,
  },
}

/* ------------------------------------------------------------------ */
/*  Model Architecture Registry                                       */
/* ------------------------------------------------------------------ */

export interface ModelArchitecture {
  id: string
  name: string
  description: string
  inputDim: number
  outputDim: number
  hiddenLayers: number[]
  activation: string
  paramCount: number
}

/**
 * Pre-defined model architectures for FL tasks.
 */
export const MODEL_ARCHITECTURES: Record<string, ModelArchitecture> = {
  'mlp-3-64': {
    id: 'mlp-3-64',
    name: 'MLP (3 layers × 64 units)',
    description: 'Multi-layer perceptron with 3 hidden layers of 64 units each. Good default for tabular biomarker data.',
    inputDim: 50, // biomarker features + protocol + demographics
    outputDim: 1, // predicted bio-age delta
    hiddenLayers: [64, 64, 64],
    activation: 'relu',
    paramCount: 8641,
  },
  'mlp-2-128': {
    id: 'mlp-2-128',
    name: 'MLP (2 layers × 128 units)',
    description: 'Wider but shallower network. Better when fewer features are available.',
    inputDim: 50,
    outputDim: 1,
    hiddenLayers: [128, 128],
    activation: 'relu',
    paramCount: 23169,
  },
  'mlp-4-32': {
    id: 'mlp-4-32',
    name: 'MLP (4 layers × 32 units)',
    description: 'Deeper but narrower. Better with differential privacy (fewer parameters = less noise impact).',
    inputDim: 50,
    outputDim: 1,
    hiddenLayers: [32, 32, 32, 32],
    activation: 'relu',
    paramCount: 3553,
  },
}

/* ------------------------------------------------------------------ */
/*  Strategy descriptions                                             */
/* ------------------------------------------------------------------ */

export const STRATEGY_DESCRIPTIONS: Record<AggregationStrategy, string> = {
  'fed-avg': 'Federated Averaging — weighted average of client model updates based on local dataset size. Simple, efficient, well-studied.',
  'fed-prox': 'FedProx — adds a proximal term to regularise heterogeneous client updates. Better for non-IID data distributions across users.',
  'fed-adam': 'Federated Adam — server-side adaptive optimisation of aggregated gradients. Better convergence on non-convex objectives.',
}

/* ------------------------------------------------------------------ */
/*  Config builder                                                    */
/* ------------------------------------------------------------------ */

/**
 * Build FL server config with overrides.
 */
export function buildFLConfig(
  overrides?: Partial<Omit<FLServerConfig, 'hyperparams'>> & {
    hyperparams?: Partial<FLHyperparams>
  },
): FLServerConfig {
  const config: FLServerConfig = {
    ...DEFAULT_FL_CONFIG,
    ...overrides,
    hyperparams: {
      ...DEFAULT_FL_CONFIG.hyperparams,
      ...overrides?.hyperparams,
    },
  }

  // Recompute per-round epsilon if total budget or rounds changed
  config.perRoundEpsilon = config.totalEpsilonBudget / config.totalRounds

  return config
}

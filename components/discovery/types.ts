import type { AeonForgeCandidateMolecule, SimulationData } from '@/lib/services/aeonforge'
import type { EvidenceGrade } from '@/lib/aeonforge/evidence-grade'

export interface DiscoveryCandidateSummary {
  id: string
  prompt: string
  candidateCount: number
  simulationScore: number | null
  safetyScore: number | null
  healthspanDelta: number | null
  status: string
  simulations: number
  virtualTwins: number
  createdAt: string | Date
  /** Evidence grade derived from simulation and safety scores. Absent for legacy records. */
  evidenceGrade?: EvidenceGrade
}

export interface DiscoverySimulationResult {
  id: string
  type: SimulationData['type'] | string
  result: SimulationData['result']
  confidence: number
  createdAt: string | Date
}

export interface DiscoveryVirtualTwinRun {
  id: string
  twinProfile: unknown
  predictedOutcomes: Record<string, unknown> | null
  createdAt: string | Date
}

export interface DiscoveryCandidatePayload {
  candidates: AeonForgeCandidateMolecule[]
  count: number
}

export interface DiscoveryCandidateDetails {
  id: string
  prompt: string
  candidates: DiscoveryCandidatePayload | null
  simulationScore: number | null
  safetyScore: number | null
  healthspanDelta: number | null
  status: string
  createdAt: string | Date
  updatedAt: string | Date
  simulationResults: DiscoverySimulationResult[]
  virtualTwinRuns: DiscoveryVirtualTwinRun[]
}
/**
 * AeonForge Sandbox Mode
 *
 * Returns deterministic mock responses for sandbox API keys,
 * avoiding real AI provider calls during integration testing.
 */

import type { AeonForgeResponse, SimulationData, VirtualTwinProfile } from '@/lib/services/aeonforge'

const MOCK_REQUEST_ID = 'sandbox-mock-00000'

export function sandboxDiscoverResponse(_prompt: string): AeonForgeResponse {
  return {
    status: 'success',
    requestId: MOCK_REQUEST_ID,
    candidates: [
      {
        id: 'sandbox-candidate-1',
        iupacName: '(2S)-2-amino-3-(4-hydroxyphenyl)propanoic acid',
        commonName: 'L-Tyrosine (sandbox)',
        smiles: 'N[C@@H](CC1=CC=C(O)C=C1)C(O)=O',
        mechanism: 'Precursor to dopamine biosynthesis — sandbox mock',
        targetPathways: ['Dopamine signaling', 'mTOR'],
        potentialSynergies: ['Vitamin B6'],
        estimatedHealthspanGain: 30,
        safetyProfile: {
          toxicity: 0.05,
          contraindications: ['MAO inhibitor use'],
          knownAdverseEvents: [],
        },
      },
    ],
    simulationResults: [],
    confidence: 0.85,
    modelVersion: 'sandbox-v1',
    warnings: ['This is a sandbox response — no real AI inference was performed.'],
    disclaimers: [
      'Sandbox data is for integration testing only. Do not use for clinical decisions.',
    ],
    executionTimeMs: 12,
  }
}

export function sandboxSimulateResponse(): SimulationData[] {
  return [
    {
      type: 'virtual_cell',
      confidence: 0.78,
      result: {
        primaryOutcome: 'Moderate upregulation of autophagy markers (sandbox)',
        secondaryOutcomes: ['Slight decrease in mTOR activity'],
        estimatedEffect: 0.15,
      },
    },
  ]
}

export function sandboxVirtualTwinResponse(): VirtualTwinProfile {
  return {
    biologicalAge: 35,
    hallmarkResponsePredictions: {
      genomicInstability: 0.08,
      telomereDysfunction: 0.12,
      epigeneticAlteration: 0.10,
      lossOfProteostasis: 0.06,
      disabledMacroautophagy: 0.18,
      mitochondrialDysfunction: 0.09,
      cellularSenescence: 0.14,
      stemCellExhaustion: 0.07,
      alteredIntercelularCommunication: 0.11,
    },
  }
}

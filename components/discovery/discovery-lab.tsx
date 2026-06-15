'use client'

import React, { useState } from 'react'

import { PromptDiscovery } from './prompt-discovery'
import { DiscoveryCandidates } from './discovery-candidates'
import { SimulationResults } from './simulation-results'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DiscoveryCandidateSummary } from './types'

interface DiscoveryLabProps {
  tier: 'explorer' | 'pro' | 'enterprise'
  recentCandidates: DiscoveryCandidateSummary[]
}

export function DiscoveryLab({
  tier,
  recentCandidates,
}: DiscoveryLabProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const selectedCandidate = recentCandidates?.find(
    (c) => c.id === selectedCandidateId
  )

  const handleCandidateDiscovered = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Discovery Lab</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Advanced pharmaceutical AI research platform. Transform scientific prompts into ranked molecular candidates worth testing — not conclusions.
        </p>
      </div>

      {/* Tier-specific disclaimers */}
      {tier === 'explorer' && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Explorer Mode:</strong> This is an educational platform showcasing AI-powered pharmaceutical discovery. 
            All candidates are unvalidated AI hypotheses — not experimental results, not medical advice. A candidate only becomes a confirmed hit after lab verification. For personalised recommendations, consult a healthcare provider.
          </AlertDescription>
        </Alert>
      )}

      {tier === 'pro' && (
        <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
          <AlertDescription className="text-purple-900 dark:text-purple-100">
            <strong>Pro Tier:</strong> You have access to full candidate discovery and simulations. 
            All simulations are hypothetical. Clinical validation required before real-world use.
          </AlertDescription>
        </Alert>
      )}

      {tier === 'enterprise' && (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            <strong>Enterprise Mode:</strong> Expanded discovery workflows with digital-twin and simulation tooling for research teams.
            Outputs remain model-generated research artifacts and require expert review before any operational or clinical use.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar: Prompt input */}
        <div className="lg:col-span-1">
          <PromptDiscovery
            tier={tier}
            onDiscovered={handleCandidateDiscovered}
          />
        </div>

        {/* Right content: Candidate hypotheses */}
        <div className="lg:col-span-2 space-y-6">
          {/* Research history */}
          <DiscoveryCandidates
            candidates={recentCandidates}
            selectedId={selectedCandidateId}
            onSelect={setSelectedCandidateId}
            refreshTrigger={refreshTrigger}
          />

          {/* Simulation details for selected candidate */}
          {selectedCandidate && (
            <SimulationResults
              candidate={selectedCandidate}
              tier={tier}
            />
          )}
        </div>
      </div>
    </div>
  )
}

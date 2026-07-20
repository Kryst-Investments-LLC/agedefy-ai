'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Beaker, BarChart3, Activity, FlaskConical } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { AnnotatedValueDisplay } from '@/components/ui/annotated-value'
import { SourceBadge } from '@/components/ui/source-badge'
import { MolecularViewer } from './molecular-viewer'
import type { AeonForgeCandidateMolecule } from '@/lib/services/aeonforge'
import type { CandidateRealityCheck } from '@/lib/services/candidate-reality-check'
import type { SaScoreResult } from '@/lib/services/sa-score'
import type {
  DiscoveryCandidateDetails,
  DiscoveryCandidateSummary,
  DiscoveryVirtualTwinRun,
} from './types'

// ── SA synthesizability badge ─────────────────────────────────────────────────

function SaScoreBadge({ sa }: { sa: SaScoreResult }) {
  const config = {
    easy: {
      label: 'Synthesizable',
      className: 'text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700',
    },
    moderate: {
      label: 'Moderate synthesis complexity',
      className: 'text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700',
    },
    hard: {
      label: 'Hard to synthesize',
      className: 'text-red-700 dark:text-red-400 border-red-300 dark:border-red-700',
    },
  }[sa.label]

  return (
    <Badge variant="outline" className={`${config.className} text-xs`}>
      SA {sa.score.toFixed(1)} — {config.label}
    </Badge>
  )
}

// ── Reality-check badge ───────────────────────────────────────────────────────

function RealityCheckBadge({ rc }: { rc: CandidateRealityCheck }) {
  if (rc.status === 'PENDING') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying against PubChem / ChEMBL…
      </span>
    )
  }

  if (rc.status === 'KNOWN_COMPOUND') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
          <FlaskConical className="h-3 w-3 mr-1" />
          Known compound
        </Badge>
        {rc.confirmedName && (
          <span className="text-muted-foreground dark:text-gray-400 truncate max-w-[180px]" title={rc.confirmedName}>
            {rc.confirmedName}
          </span>
        )}
        {rc.maxClinicalPhase != null && (
          <Badge variant="secondary" className="text-xs">
            Phase {rc.maxClinicalPhase}
          </Badge>
        )}
        {rc.pubchemCid && (
          <span className="text-muted-foreground dark:text-gray-500">CID {rc.pubchemCid}</span>
        )}
        {rc.knownBioactivities != null && (
          <span className="text-muted-foreground dark:text-gray-500">{rc.knownBioactivities} bioactivities</span>
        )}
        {rc.topTargets && rc.topTargets.length > 0 && (
          <span className="text-muted-foreground dark:text-gray-500 truncate max-w-[200px]">
            Targets: {rc.topTargets.join(', ')}
          </span>
        )}
      </div>
    )
  }

  if (rc.status === 'NOT_FOUND_IN_DATABASES') {
    return (
      <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 text-xs">
        Not found in PubChem / ChEMBL
      </Badge>
    )
  }

  // UNRESOLVABLE
  return (
    <Badge variant="outline" className="text-muted-foreground dark:text-gray-500 border-gray-200 dark:border-slate-700 text-xs">
      Database lookup unavailable
    </Badge>
  )
}

interface SimulationResultsProps {
  candidate: DiscoveryCandidateSummary
  tier: 'explorer' | 'pro' | 'enterprise'
}

export function SimulationResults({
  candidate,
  tier,
}: SimulationResultsProps) {
  const [details, setDetails] = useState<DiscoveryCandidateDetails | null>(null)
  const [molecules, setMolecules] = useState<AeonForgeCandidateMolecule[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch candidate details on selection change
  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true)
      setDetails(null)
      setMolecules([])
      try {
        const response = await fetch(`/api/aeonforge/candidates/${candidate.id}`)
        if (response.ok) {
          const data: DiscoveryCandidateDetails = await response.json()
          setDetails(data)
          setMolecules(data.candidates?.candidates ?? [])
        }
      } catch (error) {
        console.error('Failed to fetch candidate details:', error)
      } finally {
        setLoading(false)
      }
    }

    if (candidate?.id) {
      fetchDetails()
    }
  }, [candidate?.id])

  // Stream reality-check results as background jobs complete
  const hasPendingChecks = molecules.some((m) => m.realityCheck?.status === 'PENDING')
  useEffect(() => {
    if (!hasPendingChecks || !details) return

    const es = new EventSource(`/api/aeonforge/candidates/${candidate.id}/stream`)

    es.onmessage = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as
        | { kind: 'stream_end' }
        | { moleculeId: string; realityCheck: CandidateRealityCheck }

      if ('kind' in data && data.kind === 'stream_end') {
        es.close()
        return
      }

      if ('moleculeId' in data) {
        setMolecules((prev) =>
          prev.map((m) =>
            m.id === data.moleculeId ? { ...m, realityCheck: data.realityCheck } : m
          )
        )
      }
    }

    es.onerror = () => es.close()

    return () => es.close()
  }, [candidate.id, details, hasPendingChecks])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!details) return null

  const simulations = details.simulationResults
  const virtualTwin: DiscoveryVirtualTwinRun | undefined = details.virtualTwinRuns[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI-Generated Candidate Hypotheses</span>
          <Badge variant="outline">
            Illustrative confidence: {((details.simulationScore ?? 0) * 100).toFixed(0)}%
          </Badge>
        </CardTitle>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          All candidates are AI-generated hypotheses — exploratory only, not validated preclinically or clinically.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="molecules" className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="molecules">
              <Beaker className="h-4 w-4 mr-2" />
              Molecules
            </TabsTrigger>
            <TabsTrigger value="simulations">
              <BarChart3 className="h-4 w-4 mr-2" />
              AI Simulations
            </TabsTrigger>
            {tier === 'enterprise' && (
              <TabsTrigger value="digital-twin">
                <Activity className="h-4 w-4 mr-2" />
                AI Response Model
              </TabsTrigger>
            )}
          </TabsList>

          {/* Molecules Tab */}
          <TabsContent value="molecules" className="space-y-4">
            {molecules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No molecular candidates</p>
            ) : (
              <div className="space-y-3">
                {molecules.slice(0, 5).map((mol, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 dark:border-slate-800 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{mol.iupacName}</h4>
                        {mol.commonName && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {mol.commonName}
                          </p>
                        )}
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          AI-generated hypothesis — not validated
                        </p>
                      </div>
                      {mol.estimatedHealthspanGainAnnotated ? (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          <AnnotatedValueDisplay
                            annotated={mol.estimatedHealthspanGainAnnotated}
                            format={(v) => `~${v.toFixed(0)}d`}
                          />
                          <span className="text-xs text-muted-foreground ml-1">(illustrative)</span>
                        </span>
                      ) : mol.estimatedHealthspanGain ? (
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-slate-600">
                          ~{mol.estimatedHealthspanGain}d
                          <SourceBadge kind="llm" className="ml-1" />
                          <span className="ml-1 text-muted-foreground">(illustrative)</span>
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {mol.mechanism}
                    </p>

                    {mol.targetPathways && mol.targetPathways.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {mol.targetPathways.slice(0, 3).map((pathway: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {pathway}
                          </Badge>
                        ))}
                        {mol.targetPathways.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{mol.targetPathways.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {mol.safetyProfile && (
                      <div className="flex items-center gap-2 pt-2 flex-wrap">
                        <span className="text-xs font-medium">Safety est.:</span>
                        <div className="w-24 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${(1 - (mol.safetyProfile.toxicity || 0)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {((1 - (mol.safetyProfile.toxicity || 0)) * 100).toFixed(0)}%
                        </span>
                        {mol.safetyProfileAnnotated?.toxicity ? (
                          <SourceBadge
                            kind={mol.safetyProfileAnnotated.toxicity.source.kind}
                            modelId={mol.safetyProfileAnnotated.toxicity.source.modelId}
                          />
                        ) : (
                          <SourceBadge kind="llm" />
                        )}
                        <span className="text-xs text-muted-foreground">(illustrative)</span>
                      </div>
                    )}

                    {(mol.realityCheck || mol.saScore) && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 space-y-1.5">
                        {mol.realityCheck && <RealityCheckBadge rc={mol.realityCheck} />}
                        {mol.saScore && <SaScoreBadge sa={mol.saScore} />}
                      </div>
                    )}

                    {mol.smiles && (
                      <MolecularViewer
                        smiles={mol.smiles}
                        name={mol.commonName ?? mol.iupacName}
                        height={280}
                        className="mt-3"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Simulations Tab */}
          <TabsContent value="simulations" className="space-y-4">
            {simulations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No simulations available</p>
            ) : (
              <div className="space-y-3">
                {simulations.map((sim, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 dark:border-slate-800 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold capitalize">
                        {sim.type.replace(/_/g, ' ')}
                      </h4>
                      <span className="flex items-center gap-1">
                        <Badge variant="outline">
                          {(sim.confidence * 100).toFixed(0)}% (illustrative)
                        </Badge>
                        <SourceBadge kind="aeonforge-sim" />
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {sim.result?.primaryOutcome || 'Simulation completed'}
                    </p>

                    {sim.result?.secondaryOutcomes && (
                      <ul className="text-sm space-y-1 ml-4">
                        {sim.result.secondaryOutcomes.map((outcome: string, i: number) => (
                          <li key={i} className="text-gray-600 dark:text-gray-400">
                            • {outcome}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Digital Twin Tab (Enterprise only) */}
          {tier === 'enterprise' && (
            <TabsContent value="digital-twin" className="space-y-4">
              {virtualTwin ? (
                <div className="space-y-4">
                  <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <AlertDescription className="text-amber-900 dark:text-amber-100">
                      <span className="flex items-center gap-2 flex-wrap">
                        <strong>AI Hallmark Response Model:</strong>
                        <SourceBadge kind="llm" />
                      </span>
                      AI-generated exploratory predictions only — not measured, not validated. All scores are illustrative.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-3">
                    {virtualTwin.predictedOutcomes &&
                      typeof virtualTwin.predictedOutcomes === 'object' &&
                      Object.entries(virtualTwin.predictedOutcomes)
                        .slice(0, 6)
                        .map(([hallmark, rawValue]) => {
                          const value = typeof rawValue === 'number' ? rawValue : 0

                          return (
                            <div
                              key={hallmark}
                              className="border border-gray-200 dark:border-slate-800 rounded p-3"
                            >
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
                                {hallmark.replace(/_/g, ' ')}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, value * 100))}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-semibold w-8">
                                  {(value * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground dark:text-gray-500 mt-1">illustrative, not measured</p>
                            </div>
                          )
                        })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No digital twin data available
                </p>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-slate-800 mt-4">
          <Button variant="outline" className="flex-1">
            Add to Protocol
          </Button>
          <Button variant="outline" className="flex-1">
            Share with Clinician
          </Button>
          <Button variant="outline" className="flex-1">
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

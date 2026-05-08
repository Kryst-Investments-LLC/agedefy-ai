'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Beaker, BarChart3, Activity } from 'lucide-react'

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
import { MolecularViewer } from './molecular-viewer'
import type {
  DiscoveryCandidateDetails,
  DiscoveryCandidateSummary,
  DiscoveryVirtualTwinRun,
} from './types'

interface SimulationResultsProps {
  candidate: DiscoveryCandidateSummary
  tier: 'explorer' | 'pro' | 'enterprise'
}

export function SimulationResults({
  candidate,
  tier,
}: SimulationResultsProps) {
  const [details, setDetails] = useState<DiscoveryCandidateDetails | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true)
      setDetails(null)
      try {
        const response = await fetch(`/api/aeonforge/candidates/${candidate.id}`)
        if (response.ok) {
          const data: DiscoveryCandidateDetails = await response.json()
          setDetails(data)
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

  const candidates = details.candidates?.candidates ?? []
  const simulations = details.simulationResults
  const virtualTwin: DiscoveryVirtualTwinRun | undefined = details.virtualTwinRuns[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Molecular Candidates & Simulations</span>
          <Badge variant="outline">
            Confidence: {((details.simulationScore ?? 0) * 100).toFixed(0)}%
          </Badge>
        </CardTitle>
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
              Simulations
            </TabsTrigger>
            {tier === 'enterprise' && (
              <TabsTrigger value="digital-twin">
                <Activity className="h-4 w-4 mr-2" />
                Digital Twin
              </TabsTrigger>
            )}
          </TabsList>

          {/* Molecules Tab */}
          <TabsContent value="molecules" className="space-y-4">
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500">No molecular candidates</p>
            ) : (
              <div className="space-y-3">
                {candidates.slice(0, 5).map((mol, idx) => (
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
                      </div>
                      {mol.estimatedHealthspanGain && (
                        <Badge className="bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100">
                          +{mol.estimatedHealthspanGain}d
                        </Badge>
                      )}
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
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs font-medium">Safety:</span>
                        <div className="w-24 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${(1 - (mol.safetyProfile.toxicity || 0)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {((1 - (mol.safetyProfile.toxicity || 0)) * 100).toFixed(0)}%
                        </span>
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
              <p className="text-sm text-gray-500">No simulations available</p>
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
                      <Badge variant="outline">
                        {(sim.confidence * 100).toFixed(0)}% confidence
                      </Badge>
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
                  <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                    <AlertDescription className="text-purple-900 dark:text-purple-100">
                      <strong>Digital Twin Profile:</strong> Personalized multi-hallmark aging response prediction
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
                            </div>
                          )
                        })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
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

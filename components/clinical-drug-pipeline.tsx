"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Pill, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Target,
  Clock,
  AlertCircle,
  CheckCircle,
  Brain,
  Heart,
  Zap,
  Eye,
  BarChart3,
  Calendar,
  TestTube,
  Microscope,
  Flask,
  Syringe
} from 'lucide-react'

export function ClinicalDrugPipeline() {
  const [selectedPhase, setSelectedPhase] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'overview' | 'pipeline' | 'details' | 'analytics'>('overview')

  const drugCandidates = [
    {
      id: '1',
      name: 'AgeDefy-001',
      target: 'NAD+ Precursors',
      mechanism: 'NAD+ biosynthesis enhancement',
      phase: 'phase2',
      status: 'active',
      startDate: '2023-01-15',
      estimatedCompletion: '2025-06-30',
      successRate: 75,
      description: 'Novel NAD+ precursor compound for longevity enhancement',
      indications: ['Aging', 'Metabolic Health', 'Cellular Repair'],
      company: 'AgeDefy Therapeutics'
    },
    {
      id: '2',
      name: 'AgeDefy-002',
      target: 'Senolytics',
      mechanism: 'Senescent cell clearance',
      phase: 'phase1',
      status: 'active',
      startDate: '2023-06-20',
      estimatedCompletion: '2024-12-31',
      successRate: 60,
      description: 'Senolytic compound targeting cellular senescence',
      indications: ['Aging', 'Inflammation', 'Tissue Regeneration'],
      company: 'AgeDefy Therapeutics'
    },
    {
      id: '3',
      name: 'AgeDefy-003',
      target: 'Epigenetic Reprogramming',
      mechanism: 'Yamanaka factors delivery',
      phase: 'preclinical',
      status: 'active',
      startDate: '2023-09-10',
      estimatedCompletion: '2026-03-15',
      successRate: 40,
      description: 'Epigenetic reprogramming therapy for age reversal',
      indications: ['Aging', 'Cellular Reprogramming', 'Tissue Regeneration'],
      company: 'AgeDefy Therapeutics'
    },
    {
      id: '4',
      name: 'AgeDefy-004',
      target: 'Telomerase Activation',
      mechanism: 'Telomerase expression enhancement',
      phase: 'phase3',
      status: 'active',
      startDate: '2022-03-15',
      estimatedCompletion: '2024-09-30',
      successRate: 85,
      description: 'Telomerase activator for cellular longevity',
      indications: ['Aging', 'Telomere Health', 'Cellular Longevity'],
      company: 'AgeDefy Therapeutics'
    }
  ]

  const pipelineStats = {
    total: drugCandidates.length,
    preclinical: drugCandidates.filter(d => d.phase === 'preclinical').length,
    phase1: drugCandidates.filter(d => d.phase === 'phase1').length,
    phase2: drugCandidates.filter(d => d.phase === 'phase2').length,
    phase3: drugCandidates.filter(d => d.phase === 'phase3').length,
    approved: drugCandidates.filter(d => d.phase === 'approved').length,
    successRate: Math.round(drugCandidates.reduce((acc, d) => acc + d.successRate, 0) / drugCandidates.length)
  }

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'preclinical': return <TestTube className="w-4 h-4" />
      case 'phase1': return <Flask className="w-4 h-4" />
      case 'phase2': return <Microscope className="w-4 h-4" />
      case 'phase3': return <Syringe className="w-4 h-4" />
      case 'approved': return <CheckCircle className="w-4 h-4" />
      default: return <Pill className="w-4 h-4" />
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'preclinical': return 'bg-gray-100 text-gray-800'
      case 'phase1': return 'bg-blue-100 text-blue-800'
      case 'phase2': return 'bg-yellow-100 text-yellow-800'
      case 'phase3': return 'bg-orange-100 text-orange-800'
      case 'approved': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600'
      case 'completed': return 'text-blue-600'
      case 'paused': return 'text-yellow-600'
      case 'failed': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const filteredCandidates = drugCandidates.filter(candidate => 
    selectedPhase === 'all' || candidate.phase === selectedPhase
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clinical Drug Pipeline</h1>
          <p className="text-gray-600 mt-1">Advanced therapeutics in development for longevity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('overview')}
          >
            Overview
          </Button>
          <Button
            variant={viewMode === 'pipeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('pipeline')}
          >
            Pipeline
          </Button>
          <Button
            variant={viewMode === 'details' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('details')}
          >
            Details
          </Button>
          <Button
            variant={viewMode === 'analytics' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('analytics')}
          >
            Analytics
          </Button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Pill className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{pipelineStats.total}</p>
                  <p className="text-sm text-gray-600">Total Candidates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Syringe className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{pipelineStats.phase3}</p>
                  <p className="text-sm text-gray-600">Phase 3</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Microscope className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{pipelineStats.phase2}</p>
                  <p className="text-sm text-gray-600">Phase 2</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{pipelineStats.successRate}%</p>
                  <p className="text-sm text-gray-600">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={selectedPhase === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPhase('all')}
            >
              All Phases
            </Button>
            <Button
              variant={selectedPhase === 'preclinical' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPhase('preclinical')}
              className="flex items-center gap-1"
            >
              <TestTube className="w-3 h-3" />
              Preclinical
            </Button>
            <Button
              variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPhase('phase1')}
              className="flex items-center gap-1"
            >
              <Flask className="w-3 h-3" />
              Phase 1
            </Button>
            <Button
              variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPhase('phase2')}
              className="flex items-center gap-1"
            >
              <Microscope className="w-3 h-3" />
              Phase 2
            </Button>
            <Button
              variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPhase('phase3')}
              className="flex items-center gap-1"
            >
              <Syringe className="w-3 h-3" />
              Phase 3
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCandidates.map((candidate) => (
              <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {getPhaseIcon(candidate.phase)}
                      <h3 className="font-semibold text-lg">{candidate.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPhaseColor(candidate.phase)}>
                        {candidate.phase}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(candidate.status)}>
                        {candidate.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{candidate.description}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Target:</span>
                      <span className="font-medium">{candidate.target}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Mechanism:</span>
                      <span className="font-medium">{candidate.mechanism}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Success Rate:</span>
                      <span className={`font-semibold ${getSuccessRateColor(candidate.successRate)}`}>
                        {candidate.successRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Company:</span>
                      <span className="font-medium">{candidate.company}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Indications:</h4>
                    <div className="flex flex-wrap gap-1">
                      {candidate.indications.map((indication, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {indication}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{candidate.successRate}%</span>
                    </div>
                    <Progress value={candidate.successRate} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Preclinical</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gray-600 h-2 rounded-full" 
                        style={{ width: `${(pipelineStats.preclinical / pipelineStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{pipelineStats.preclinical}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Phase 1</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(pipelineStats.phase1 / pipelineStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{pipelineStats.phase1}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Phase 2</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full" 
                        style={{ width: `${(pipelineStats.phase2 / pipelineStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{pipelineStats.phase2}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Phase 3</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full" 
                        style={{ width: `${(pipelineStats.phase3 / pipelineStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{pipelineStats.phase3}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Overall Success Rate</span>
                    <span>{pipelineStats.successRate}%</span>
                  </div>
                  <Progress value={pipelineStats.successRate} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Phase 3 Success</span>
                    <span>85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Phase 2 Success</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Phase 1 Success</span>
                    <span>60%</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View Full Pipeline
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Timeline View
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics Report
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
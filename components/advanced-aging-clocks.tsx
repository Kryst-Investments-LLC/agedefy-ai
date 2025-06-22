"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Target,
  Calendar,
  AlertCircle,
  CheckCircle,
  Brain,
  Heart,
  Zap,
  Eye,
  BarChart3,
  Dna,
  Timer
} from 'lucide-react'

interface AgingClock {
  id: string
  name: string
  type: 'epigenetic' | 'metabolic' | 'inflammatory' | 'composite'
  currentAge: number
  chronologicalAge: number
  accuracy: number
  description: string
  biomarkers: string[]
  lastUpdated: string
  trend: 'improving' | 'stable' | 'declining'
}

interface ClockComparison {
  clock: AgingClock
  difference: number
  percentile: number
  recommendation: string
}

export function AdvancedAgingClocks() {
  const [selectedClock, setSelectedClock] = useState<AgingClock | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'comparison' | 'trends' | 'details'>('overview')

  // Mock aging clocks
  const [clocks] = useState<AgingClock[]>([
    {
      id: '1',
      name: 'Horvath Epigenetic Clock',
      type: 'epigenetic',
      currentAge: 42,
      chronologicalAge: 45,
      accuracy: 95,
      description: 'DNA methylation-based aging clock measuring epigenetic age',
      biomarkers: ['DNA Methylation', 'CpG Sites', 'Epigenetic Markers'],
      lastUpdated: '2024-01-15',
      trend: 'improving'
    },
    {
      id: '2',
      name: 'Hannum Epigenetic Clock',
      type: 'epigenetic',
      currentAge: 41,
      chronologicalAge: 45,
      accuracy: 93,
      description: 'Blood-based epigenetic clock using 71 CpG sites',
      biomarkers: ['Blood Methylation', 'CpG Sites', 'Leukocyte Count'],
      lastUpdated: '2024-01-15',
      trend: 'improving'
    },
    {
      id: '3',
      name: 'PhenoAge Clock',
      type: 'composite',
      currentAge: 43,
      chronologicalAge: 45,
      accuracy: 88,
      description: 'Composite clock combining clinical biomarkers and DNA methylation',
      biomarkers: ['Clinical Markers', 'DNA Methylation', 'Mortality Risk'],
      lastUpdated: '2024-01-15',
      trend: 'stable'
    },
    {
      id: '4',
      name: 'GrimAge Clock',
      type: 'composite',
      currentAge: 44,
      chronologicalAge: 45,
      accuracy: 91,
      description: 'Mortality risk prediction clock using DNA methylation',
      biomarkers: ['Mortality Risk', 'DNA Methylation', 'Lifestyle Factors'],
      lastUpdated: '2024-01-15',
      trend: 'declining'
    }
  ])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'epigenetic': return <Dna className="w-4 h-4" />
      case 'metabolic': return <Activity className="w-4 h-4" />
      case 'inflammatory': return <Heart className="w-4 h-4" />
      case 'composite': return <BarChart3 className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="w-4 h-4 text-green-600" />
      case 'stable': return <Activity className="w-4 h-4 text-gray-600" />
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-600" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600'
      case 'stable': return 'text-gray-600'
      case 'declining': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600'
    if (accuracy >= 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  const averageAge = clocks.reduce((acc, clock) => acc + clock.currentAge, 0) / clocks.length
  const averageDifference = clocks.reduce((acc, clock) => acc + (clock.chronologicalAge - clock.currentAge), 0) / clocks.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Aging Clocks</h1>
          <p className="text-gray-600 mt-1">Comprehensive biological age assessment using multiple clocks</p>
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
            variant={viewMode === 'comparison' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('comparison')}
          >
            Comparison
          </Button>
          <Button
            variant={viewMode === 'trends' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('trends')}
          >
            Trends
          </Button>
          <Button
            variant={viewMode === 'details' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('details')}
          >
            Details
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{Math.round(averageAge)}</p>
                  <p className="text-sm text-gray-600">Average Biological Age</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{clocks[0]?.chronologicalAge || 0}</p>
                  <p className="text-sm text-gray-600">Chronological Age</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{Math.round(averageDifference)}</p>
                  <p className="text-sm text-gray-600">Years Younger</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{clocks.length}</p>
                  <p className="text-sm text-gray-600">Active Clocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clock Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clocks.map((clock) => (
          <Card 
            key={clock.id} 
            className={`hover:shadow-lg transition-shadow cursor-pointer ${
              selectedClock?.id === clock.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedClock(clock)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getTypeIcon(clock.type)}
                  <h3 className="font-semibold">{clock.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(clock.trend)}
                  <Badge variant="outline" className="capitalize">
                    {clock.type}
                  </Badge>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">{clock.description}</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Biological Age:</span>
                  <span className="font-semibold">{clock.currentAge} years</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Chronological Age:</span>
                  <span>{clock.chronologicalAge} years</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Difference:</span>
                  <span className={`font-semibold ${getTrendColor(clock.trend)}`}>
                    {clock.chronologicalAge - clock.currentAge} years
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Accuracy:</span>
                  <span className={`font-semibold ${getAccuracyColor(clock.accuracy)}`}>
                    {clock.accuracy}%
                  </span>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Biomarkers:</h4>
                <div className="flex flex-wrap gap-1">
                  {clock.biomarkers.map((biomarker, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {biomarker}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 text-xs text-gray-500">
                Last updated: {clock.lastUpdated}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <Card>
          <CardHeader>
            <CardTitle>Clock Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clocks.map((clock) => {
                const difference = clock.chronologicalAge - clock.currentAge
                const percentile = difference > 0 ? 75 : 25
                return (
                  <div key={clock.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="font-medium">{clock.name}</h4>
                        <p className="text-sm text-gray-600">{clock.type} clock</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold">{clock.currentAge}</div>
                        <div className="text-sm text-gray-600">Biological</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{clock.chronologicalAge}</div>
                        <div className="text-sm text-gray-600">Chronological</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${getTrendColor(clock.trend)}`}>
                          {difference > 0 ? '+' : ''}{difference}
                        </div>
                        <div className="text-sm text-gray-600">Difference</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{percentile}%</div>
                        <div className="text-sm text-gray-600">Percentile</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details View */}
      {viewMode === 'details' && selectedClock && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedClock.name} Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-gray-600">{selectedClock.description}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Biomarkers Used</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedClock.biomarkers.map((biomarker, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{biomarker}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Technical Specifications</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Accuracy:</span> {selectedClock.accuracy}%
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedClock.type}
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span> {selectedClock.lastUpdated}
                  </div>
                  <div>
                    <span className="font-medium">Trend:</span> {selectedClock.trend}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View Full Report
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule Next Test
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Export Data
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}  
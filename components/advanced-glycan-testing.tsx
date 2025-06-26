"use client"

import { 
  Dna, 
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
  Microscope
} from 'lucide-react'
import React, { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface GlycanMarker {
  id: string
  name: string
  category: 'n-glycan' | 'o-glycan' | 'glycosaminoglycan'
  currentValue: number
  referenceRange: { min: number; max: number }
  unit: string
  trend: 'up' | 'down' | 'stable'
  significance: 'high' | 'medium' | 'low'
  description: string
  healthImplications: string[]
}

interface GlycanTest {
  id: string
  date: string
  markers: GlycanMarker[]
  overallScore: number
  inflammationScore: number
  agingScore: number
  recommendations: string[]
}

export function AdvancedGlycanTesting() {
  const [viewMode, setViewMode] = useState<'overview' | 'markers' | 'trends' | 'insights'>('overview')

  const markers = [
    {
      id: '1',
      name: 'N-Glycan Hex5HexNAc4',
      category: 'n-glycan',
      currentValue: 85,
      referenceRange: { min: 70, max: 90 },
      unit: '%',
      trend: 'up',
      significance: 'high',
      description: 'Core N-glycan structure associated with inflammation',
      healthImplications: ['Inflammation marker', 'Immune response', 'Aging indicator']
    },
    {
      id: '2',
      name: 'O-Glycan Sialylation',
      category: 'o-glycan',
      currentValue: 72,
      referenceRange: { min: 65, max: 80 },
      unit: '%',
      trend: 'stable',
      significance: 'medium',
      description: 'Sialic acid content in O-glycans',
      healthImplications: ['Cell signaling', 'Immune regulation', 'Cancer risk']
    },
    {
      id: '3',
      name: 'Hyaluronic Acid',
      category: 'glycosaminoglycan',
      currentValue: 45,
      referenceRange: { min: 30, max: 60 },
      unit: 'mg/L',
      trend: 'down',
      significance: 'high',
      description: 'Major glycosaminoglycan in connective tissue',
      healthImplications: ['Joint health', 'Skin aging', 'Tissue repair']
    },
    {
      id: '4',
      name: 'N-Glycan Branching',
      category: 'n-glycan',
      currentValue: 68,
      referenceRange: { min: 60, max: 75 },
      unit: '%',
      trend: 'up',
      significance: 'medium',
      description: 'Complexity of N-glycan branching patterns',
      healthImplications: ['Immune function', 'Protein stability', 'Disease risk']
    }
  ]

  const currentTest = {
    id: '1',
    date: '2024-01-15',
    markers: markers,
    overallScore: 76,
    inflammationScore: 68,
    agingScore: 72,
    recommendations: [
      'Increase anti-inflammatory diet',
      'Add omega-3 supplementation',
      'Implement stress reduction techniques',
      'Consider hyaluronic acid supplementation'
    ]
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'n-glycan': return <Dna className="w-4 h-4" />
      case 'o-glycan': return <Activity className="w-4 h-4" />
      case 'glycosaminoglycan': return <TestTube className="w-4 h-4" />
      default: return <Microscope className="w-4 h-4" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-600" />
      case 'down': return <TrendingDown className="w-4 h-4 text-green-600" />
      case 'stable': return <Activity className="w-4 h-4 text-gray-600" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getValueStatus = (value: number, range: { min: number; max: number }) => {
    if (value < range.min) return 'low'
    if (value > range.max) return 'high'
    return 'normal'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'low': return 'text-blue-600'
      case 'high': return 'text-red-600'
      case 'normal': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Glycan Testing</h1>
          <p className="text-gray-600 mt-1">Comprehensive analysis of glycans for health optimization</p>
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
            variant={viewMode === 'markers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('markers')}
          >
            Markers
          </Button>
          <Button
            variant={viewMode === 'trends' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('trends')}
          >
            Trends
          </Button>
          <Button
            variant={viewMode === 'insights' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('insights')}
          >
            Insights
          </Button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Microscope className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{currentTest.overallScore}%</p>
                  <p className="text-sm text-gray-600">Overall Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{currentTest.inflammationScore}%</p>
                  <p className="text-sm text-gray-600">Inflammation Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{currentTest.agingScore}%</p>
                  <p className="text-sm text-gray-600">Aging Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TestTube className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{markers.length}</p>
                  <p className="text-sm text-gray-600">Markers Tested</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'markers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markers.map((marker) => {
              const status = getValueStatus(marker.currentValue, marker.referenceRange)
              return (
                <Card key={marker.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(marker.category)}
                        <h3 className="font-semibold">{marker.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(marker.trend)}
                        <Badge variant="outline" className="capitalize">
                          {marker.category}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">{marker.description}</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Current Value:</span>
                        <span className={`font-semibold ${getStatusColor(status)}`}>
                          {marker.currentValue} {marker.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Reference Range:</span>
                        <span>
                          {marker.referenceRange.min}-{marker.referenceRange.max} {marker.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Significance:</span>
                        <span className={`font-semibold ${getSignificanceColor(marker.significance)}`}>
                          {marker.significance}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Status:</span>
                        <span className={`font-semibold ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Health Implications:</h4>
                      <div className="flex flex-wrap gap-1">
                        {marker.healthImplications.map((implication, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {implication}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'insights' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Glycan Analysis Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Inflammation Profile</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Inflammation Level</span>
                        <span>{currentTest.inflammationScore}%</span>
                      </div>
                      <Progress value={currentTest.inflammationScore} className="h-2" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Elevated N-glycan markers suggest increased inflammatory activity.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Aging Biomarkers</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Aging Score</span>
                        <span>{currentTest.agingScore}%</span>
                      </div>
                      <Progress value={currentTest.agingScore} className="h-2" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Glycan patterns indicate moderate cellular aging processes.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Recommendations</h4>
                  <div className="space-y-2">
                    {currentTest.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                        <span className="text-sm">{recommendation}</span>
                      </div>
                    ))}
                  </div>
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
              <Microscope className="w-4 h-4" />
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
  Calendar
} from 'lucide-react'

interface EpigeneticMarker {
  id: string
  name: string
  category: 'methylation' | 'acetylation' | 'phosphorylation' | 'ubiquitination'
  currentValue: number
  targetValue: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  impact: 'positive' | 'negative' | 'neutral'
  description: string
  interventions: string[]
}

interface EpigeneticTest {
  id: string
  date: string
  markers: EpigeneticMarker[]
  overallScore: number
  biologicalAge: number
  chronologicalAge: number
  recommendations: string[]
}

export function EpigeneticFeedback() {
  const [viewMode, setViewMode] = useState<'overview' | 'markers' | 'trends' | 'recommendations'>('overview')

  const markers = [
    {
      id: '1',
      name: 'DNA Methylation Age',
      category: 'methylation',
      currentValue: 42,
      targetValue: 35,
      unit: 'years',
      trend: 'down',
      impact: 'positive',
      description: 'Epigenetic age based on DNA methylation patterns',
      interventions: ['NAD+ precursors', 'Fasting', 'Exercise']
    },
    {
      id: '2',
      name: 'Telomere Length',
      category: 'methylation',
      currentValue: 85,
      targetValue: 90,
      unit: '%',
      trend: 'up',
      impact: 'positive',
      description: 'Length of telomeric DNA sequences',
      interventions: ['TA-65', 'Exercise', 'Stress reduction']
    }
  ]

  const currentTest = {
    biologicalAge: 42,
    chronologicalAge: 45,
    overallScore: 78,
    recommendations: [
      'Increase NAD+ supplementation',
      'Implement intermittent fasting',
      'Add strength training to routine'
    ]
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'methylation': return <Dna className="w-4 h-4" />
      case 'acetylation': return <Activity className="w-4 h-4" />
      case 'phosphorylation': return <Zap className="w-4 h-4" />
      case 'ubiquitination': return <Target className="w-4 h-4" />
      default: return <Dna className="w-4 h-4" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'stable': return <Activity className="w-4 h-4 text-gray-600" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'text-green-600'
      case 'negative': return 'text-red-600'
      case 'neutral': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const ageDifference = currentTest.chronologicalAge - currentTest.biologicalAge

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Epigenetic Feedback</h1>
          <p className="text-gray-600 mt-1">Monitor your epigenetic markers and biological age</p>
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
            variant={viewMode === 'recommendations' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('recommendations')}
          >
            Recommendations
          </Button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Dna className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{currentTest.biologicalAge}</p>
                  <p className="text-sm text-gray-600">Biological Age</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{currentTest.chronologicalAge}</p>
                  <p className="text-sm text-gray-600">Chronological Age</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{ageDifference}</p>
                  <p className="text-sm text-gray-600">Years Younger</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{currentTest.overallScore}%</p>
                  <p className="text-sm text-gray-600">Epigenetic Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'markers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markers.map((marker) => (
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
                      <span>Current: {marker.currentValue} {marker.unit}</span>
                      <span>Target: {marker.targetValue} {marker.unit}</span>
                    </div>
                    <Progress 
                      value={(marker.currentValue / marker.targetValue) * 100} 
                      className="h-2" 
                    />
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className={getImpactColor(marker.impact)}>
                        Impact: {marker.impact}
                      </span>
                      <span>
                        {Math.round((marker.currentValue / marker.targetValue) * 100)}% of target
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'recommendations' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalized Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentTest.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">{recommendation}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Based on your current epigenetic profile
                      </p>
                    </div>
                  </div>
                ))}
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
              <Dna className="w-4 h-4" />
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
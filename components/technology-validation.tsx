"use client"

import {
  Brain,
  Target,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Clock,
  Users,
  Award,
  Microscope,
} from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const aiProviderMetrics = [
  {
    provider: "OpenAI GPT-4",
    accuracy: 89,
    responseTime: "1.2s",
    reliability: 99.8,
    cost: "$0.03/1K tokens",
    status: "active",
    strengths: ["Natural language processing", "Medical knowledge", "Reasoning"],
    weaknesses: ["Cost", "Rate limits"],
  },
  {
    provider: "Anthropic Claude",
    accuracy: 87,
    responseTime: "1.8s",
    reliability: 99.5,
    cost: "$0.025/1K tokens",
    status: "active",
    strengths: ["Safety-focused", "Long context", "Ethical reasoning"],
    weaknesses: ["Slower responses", "Limited availability"],
  },
  {
    provider: "Grok",
    accuracy: 85,
    responseTime: "2.1s",
    reliability: 98.9,
    cost: "$0.02/1K tokens",
    status: "active",
    strengths: ["Real-time data", "Cost-effective", "Conversational"],
    weaknesses: ["Lower accuracy", "Beta status"],
  },
]

const ensembleMetrics = {
  combinedAccuracy: 94.2,
  consensusRate: 87.5,
  conflictResolution: 92.1,
  averageResponseTime: "1.7s",
  costOptimization: 23,
  reliabilityImprovement: 15.3,
}

const validationTests = [
  {
    category: "Health Recommendations",
    testCases: 1247,
    accuracy: 94.2,
    benchmark: "Clinical Guidelines",
    status: "passed",
    details: "Compared against peer-reviewed medical literature",
  },
  {
    category: "Drug Interactions",
    testCases: 892,
    accuracy: 97.8,
    benchmark: "FDA Database",
    status: "passed",
    details: "Validated against official drug interaction databases",
  },
  {
    category: "Biomarker Analysis",
    testCases: 634,
    accuracy: 91.5,
    benchmark: "Lab Standards",
    status: "passed",
    details: "Cross-referenced with clinical laboratory ranges",
  },
  {
    category: "Research Summarization",
    testCases: 2156,
    accuracy: 88.9,
    benchmark: "Expert Review",
    status: "passed",
    details: "Validated by longevity researchers and clinicians",
  },
  {
    category: "Personalization Engine",
    testCases: 445,
    accuracy: 84.3,
    benchmark: "User Outcomes",
    status: "monitoring",
    details: "Long-term outcome tracking in progress",
  },
]

const benchmarkComparisons = [
  {
    metric: "Recommendation Accuracy",
    agedefy: 94.2,
    competitor1: 78.5,
    competitor2: 82.1,
    industry: 75.3,
  },
  {
    metric: "Response Time",
    agedefy: 1.7,
    competitor1: 3.2,
    competitor2: 2.8,
    industry: 4.1,
  },
  {
    metric: "Safety Score",
    agedefy: 97.8,
    competitor1: 89.2,
    competitor2: 91.7,
    industry: 85.4,
  },
  {
    metric: "User Satisfaction",
    agedefy: 4.7,
    competitor1: 3.9,
    competitor2: 4.1,
    industry: 3.6,
  },
]

export function TechnologyValidation() {
  const [selectedProvider, setSelectedProvider] = useState("ensemble")

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Technology Validation</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comprehensive validation of AI Ensemble Intelligence with real-world benchmarks and performance metrics
          </p>
        </div>

        {/* AI Ensemble Performance */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">AI Ensemble Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Brain className="h-8 w-8 text-purple-400" />
                  <Badge className="bg-green-600/20 text-green-300">+10.2%</Badge>
                </div>
                <div className="text-2xl font-bold text-white mb-1">94.2%</div>
                <div className="text-sm text-gray-400">Combined Accuracy</div>
                <div className="text-xs text-green-400 mt-1">vs 84% single-AI average</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Shield className="h-8 w-8 text-green-400" />
                  <Badge className="bg-blue-600/20 text-blue-300">Validated</Badge>
                </div>
                <div className="text-2xl font-bold text-white mb-1">97.8%</div>
                <div className="text-sm text-gray-400">Safety Score</div>
                <div className="text-xs text-green-400 mt-1">FDA benchmark compliance</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="h-8 w-8 text-teal-400" />
                  <Badge className="bg-yellow-600/20 text-yellow-300">Optimized</Badge>
                </div>
                <div className="text-2xl font-bold text-white mb-1">1.7s</div>
                <div className="text-sm text-gray-400">Avg Response Time</div>
                <div className="text-xs text-green-400 mt-1">23% cost reduction</div>
              </CardContent>
            </Card>
          </div>

          {/* AI Provider Comparison */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Individual AI Provider Performance</CardTitle>
              <CardDescription>Detailed metrics for each AI provider in the ensemble</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {aiProviderMetrics.map((provider, index) => (
                  <div key={index} className="border border-gray-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">{provider.provider}</h3>
                      <Badge className="bg-green-600/20 text-green-300">{provider.status}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-400">Accuracy</div>
                        <div className="text-lg font-semibold text-white">{provider.accuracy}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Response Time</div>
                        <div className="text-lg font-semibold text-white">{provider.responseTime}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Reliability</div>
                        <div className="text-lg font-semibold text-white">{provider.reliability}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Cost</div>
                        <div className="text-lg font-semibold text-white">{provider.cost}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-green-400 mb-2">Strengths</h4>
                        <div className="space-y-1">
                          {provider.strengths.map((strength, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                              <CheckCircle className="h-3 w-3 text-green-400" />
                              {strength}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-yellow-400 mb-2">Considerations</h4>
                        <div className="space-y-1">
                          {provider.weaknesses.map((weakness, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                              <AlertTriangle className="h-3 w-3 text-yellow-400" />
                              {weakness}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Validation Test Results */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Validation Test Results</h2>
          <div className="space-y-4">
            {validationTests.map((test, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{test.category}</h3>
                      <p className="text-sm text-gray-400">{test.details}</p>
                    </div>
                    <Badge 
                      className={
                        test.status === 'passed' 
                          ? "bg-green-600/20 text-green-300" 
                          : "bg-yellow-600/20 text-yellow-300"
                      }
                    >
                      {test.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Test Cases</div>
                      <div className="text-lg font-semibold text-white">{test.testCases.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Accuracy</div>
                      <div className="text-lg font-semibold text-white">{test.accuracy}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Benchmark</div>
                      <div className="text-lg font-semibold text-white">{test.benchmark}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Progress value={test.accuracy} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benchmark Comparisons */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Industry Benchmark Comparison</h2>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8">
              <div className="space-y-8">
                {benchmarkComparisons.map((benchmark, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">{benchmark.metric}</h3>
                      <Badge className="bg-teal-600/20 text-teal-300">
                        {benchmark.metric === "Response Time" ? "Faster" : "Higher"}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-sm text-gray-400">AgeDefy AI</div>
                        <div className="text-xl font-bold text-teal-400">
                          {benchmark.agedefy}{benchmark.metric === "Response Time" ? "s" : benchmark.metric === "User Satisfaction" ? "/5" : "%"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-400">Competitor A</div>
                        <div className="text-xl font-bold text-gray-300">
                          {benchmark.competitor1}{benchmark.metric === "Response Time" ? "s" : benchmark.metric === "User Satisfaction" ? "/5" : "%"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-400">Competitor B</div>
                        <div className="text-xl font-bold text-gray-300">
                          {benchmark.competitor2}{benchmark.metric === "Response Time" ? "s" : benchmark.metric === "User Satisfaction" ? "/5" : "%"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-400">Industry Avg</div>
                        <div className="text-xl font-bold text-gray-500">
                          {benchmark.industry}{benchmark.metric === "Response Time" ? "s" : benchmark.metric === "User Satisfaction" ? "/5" : "%"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <Progress 
                        value={benchmark.metric === "Response Time" ? 
                          Math.max(0, 100 - (benchmark.agedefy / benchmark.industry * 100)) : 
                          (benchmark.agedefy / (benchmark.metric === "User Satisfaction" ? 5 : 100)) * 100
                        } 
                        className="h-3" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Continuous Monitoring */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-purple-600/20 to-teal-600/20 border-purple-500/20">
            <CardContent className="p-8">
              <Microscope className="h-12 w-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Continuous Validation</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Real-time monitoring and validation ensure our AI Ensemble Intelligence maintains superior performance and safety standards
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  View Live Metrics
                </Button>
                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white">
                  Download Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

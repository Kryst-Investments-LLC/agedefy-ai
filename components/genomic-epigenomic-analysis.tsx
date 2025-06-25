"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dna, Brain, Heart, Shield, TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function GenomicEpigenomicAnalysis() {
  const { t } = useTranslation()
  const [analysisStatus, setAnalysisStatus] = useState("completed")

  const geneticVariants = [
    { gene: "APOE", variant: "ε3/ε3", risk: "low", category: "Alzheimer's", impact: "Protective" },
    { gene: "MTHFR", variant: "C677T", risk: "medium", category: "Methylation", impact: "Reduced folate metabolism" },
    { gene: "COMT", variant: "Val158Met", risk: "low", category: "Neurotransmitters", impact: "Normal dopamine clearance" },
    { gene: "SIRT1", variant: "rs7069102", risk: "low", category: "Longevity", impact: "Enhanced longevity pathways" },
    { gene: "FOXO3", variant: "rs2802292", risk: "beneficial", category: "Longevity", impact: "Increased lifespan potential" }
  ]

  const epigeneticMarkers = [
    { marker: "DNA Methylation Age", value: 28.5, chronological: 32, status: "younger" },
    { marker: "Telomere Length", value: 8.2, percentile: 75, status: "above_average" },
    { marker: "Inflammatory Age", value: 25.1, chronological: 32, status: "younger" },
    { marker: "Metabolic Age", value: 30.8, chronological: 32, status: "slightly_younger" }
  ]

  const personalizedStrategies = [
    {
      category: "Methylation Support",
      recommendations: [
        "Increase folate-rich foods (leafy greens, legumes)",
        "Consider methylated B-vitamin supplementation",
        "Monitor homocysteine levels quarterly"
      ],
      priority: "high"
    },
    {
      category: "Longevity Optimization",
      recommendations: [
        "Implement intermittent fasting protocols",
        "Increase resveratrol and NAD+ precursors",
        "Focus on SIRT1 activating compounds"
      ],
      priority: "medium"
    },
    {
      category: "Neuroprotection",
      recommendations: [
        "Maintain omega-3 fatty acid levels",
        "Regular cognitive training exercises",
        "Stress management and meditation"
      ],
      priority: "medium"
    }
  ]

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "beneficial": return "text-green-400 bg-green-900/20 border-green-700"
      case "low": return "text-blue-400 bg-blue-900/20 border-blue-700"
      case "medium": return "text-yellow-400 bg-yellow-900/20 border-yellow-700"
      case "high": return "text-red-400 bg-red-900/20 border-red-700"
      default: return "text-gray-400 bg-gray-900/20 border-gray-700"
    }
  }

  const getAgeStatusColor = (status: string) => {
    switch (status) {
      case "younger": return "text-green-400"
      case "slightly_younger": return "text-blue-400"
      case "above_average": return "text-green-400"
      default: return "text-gray-400"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Genomic & Epigenomic Analysis</h2>
        <p className="text-gray-400">Personalized longevity strategies based on your genetic profile</p>
      </div>

      <Tabs defaultValue="genetic" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="genetic" className="text-gray-300">Genetic Variants</TabsTrigger>
          <TabsTrigger value="epigenetic" className="text-gray-300">Epigenetic Age</TabsTrigger>
          <TabsTrigger value="strategies" className="text-gray-300">Personalized Plans</TabsTrigger>
          <TabsTrigger value="upload" className="text-gray-300">Upload Data</TabsTrigger>
        </TabsList>

        <TabsContent value="genetic" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {geneticVariants.map((variant, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Dna className="h-5 w-5 text-purple-400" />
                      {variant.gene}
                    </CardTitle>
                    <Badge className={getRiskColor(variant.risk)}>
                      {variant.risk}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {variant.category}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Variant:</span>
                      <span className="text-sm text-white font-mono">{variant.variant}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      <strong>Impact:</strong> {variant.impact}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="epigenetic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {epigeneticMarkers.map((marker, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg">{marker.marker}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">
                        {marker.value}
                        {marker.marker.includes("Age") ? " years" : marker.marker.includes("Length") ? " kb" : ""}
                      </div>
                      {marker.chronological && (
                        <div className="text-sm text-gray-400">
                          vs {marker.chronological} chronological
                        </div>
                      )}
                      {marker.percentile && (
                        <div className="text-sm text-gray-400">
                          {marker.percentile}th percentile
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <Badge className={`${getAgeStatusColor(marker.status)} bg-transparent border-current`}>
                        {marker.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Biological Age Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400">-3.5</div>
                  <div className="text-sm text-gray-400">Years younger</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">92%</div>
                  <div className="text-sm text-gray-400">Optimization score</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">+8.2</div>
                  <div className="text-sm text-gray-400">Longevity potential</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <div className="space-y-4">
            {personalizedStrategies.map((strategy, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {strategy.category === "Methylation Support" && <Brain className="h-5 w-5 text-blue-400" />}
                      {strategy.category === "Longevity Optimization" && <Dna className="h-5 w-5 text-purple-400" />}
                      {strategy.category === "Neuroprotection" && <Shield className="h-5 w-5 text-green-400" />}
                      {strategy.category}
                    </CardTitle>
                    <Badge variant={strategy.priority === "high" ? "destructive" : "secondary"}>
                      {strategy.priority} priority
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {strategy.recommendations.map((rec, recIndex) => (
                      <li key={recIndex} className="flex items-start gap-2 text-sm text-gray-300">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Upload Genetic Data</CardTitle>
              <CardDescription className="text-gray-400">
                Upload raw data from 23andMe, AncestryDNA, or other genetic testing services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                <Dna className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Drag and drop your genetic data file here</p>
                <Button variant="outline">Choose File</Button>
              </div>
              <div className="text-xs text-gray-500">
                Supported formats: .txt, .csv from 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { Shield, Brain, Heart, AlertTriangle, TrendingUp, CheckCircle, Activity, Zap } from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AIDrivenDiseasePrevention() {
  const [selectedRisk, setSelectedRisk] = useState("cardiovascular")

  const riskAssessments = [
    { 
      id: "cardiovascular", 
      name: "Cardiovascular Disease", 
      risk: 23, 
      status: "moderate",
      factors: ["Family history", "Cholesterol levels", "Blood pressure"],
      interventions: ["Mediterranean diet", "Regular cardio", "Omega-3 supplements"]
    },
    { 
      id: "diabetes", 
      name: "Type 2 Diabetes", 
      risk: 15, 
      status: "low",
      factors: ["BMI", "Glucose tolerance", "Insulin sensitivity"],
      interventions: ["Low-carb diet", "Intermittent fasting", "Metformin consideration"]
    },
    { 
      id: "alzheimers", 
      name: "Alzheimer's Disease", 
      risk: 31, 
      status: "high",
      factors: ["APOE4 variant", "Cognitive decline", "Sleep quality"],
      interventions: ["Brain training", "Quality sleep", "Neuroprotective compounds"]
    },
    { 
      id: "cancer", 
      name: "Cancer Risk", 
      risk: 18, 
      status: "low",
      factors: ["Genetic markers", "Lifestyle factors", "Environmental exposure"],
      interventions: ["Antioxidant-rich diet", "Regular screening", "Stress management"]
    }
  ]

  const preventionProtocols = [
    {
      name: "Cardiovascular Protection Protocol",
      duration: "6 months",
      compliance: 87,
      interventions: [
        { name: "Omega-3 EPA/DHA", dosage: "2g daily", status: "active" },
        { name: "CoQ10", dosage: "200mg daily", status: "active" },
        { name: "Zone 2 Cardio", frequency: "4x/week", status: "active" },
        { name: "Mediterranean Diet", adherence: "85%", status: "active" }
      ]
    },
    {
      name: "Neuroprotection Protocol",
      duration: "12 months",
      compliance: 92,
      interventions: [
        { name: "Lion's Mane", dosage: "1g daily", status: "active" },
        { name: "Bacopa Monnieri", dosage: "300mg daily", status: "active" },
        { name: "Cognitive Training", frequency: "Daily", status: "active" },
        { name: "Quality Sleep", target: "8 hours", status: "needs_improvement" }
      ]
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "low": return "text-green-400"
      case "moderate": return "text-yellow-400"
      case "high": return "text-red-400"
      default: return "text-gray-400"
    }
  }

  const getRiskColor = (risk: number) => {
    if (risk < 20) return "bg-green-500"
    if (risk < 30) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">AI-Driven Disease Prevention</h2>
        <p className="text-gray-400">Predictive analytics and personalized prevention strategies</p>
      </div>

      <Tabs defaultValue="risk-assessment" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="risk-assessment" className="text-gray-300">Risk Assessment</TabsTrigger>
          <TabsTrigger value="prevention-protocols" className="text-gray-300">Prevention Protocols</TabsTrigger>
          <TabsTrigger value="ai-insights" className="text-gray-300">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="risk-assessment" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {riskAssessments.map((assessment) => (
              <Card 
                key={assessment.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedRisk === assessment.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedRisk(assessment.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-400" />
                      {assessment.name}
                    </CardTitle>
                    <Badge className={`${getStatusColor(assessment.status)} bg-transparent border-current`}>
                      {assessment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Risk Score</span>
                      <span className="text-white font-bold">{assessment.risk}%</span>
                    </div>
                    <Progress value={assessment.risk} className={`h-2 ${getRiskColor(assessment.risk)}`} />
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300">Key Risk Factors:</h4>
                      {assessment.factors.map((factor, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-yellow-400" />
                          <span className="text-xs text-gray-400">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedRisk && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Recommended Interventions</CardTitle>
                <CardDescription className="text-gray-400">
                  Personalized prevention strategies for {riskAssessments.find(r => r.id === selectedRisk)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {riskAssessments.find(r => r.id === selectedRisk)?.interventions.map((intervention, index) => (
                    <div key={index} className="p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-white">{intervention}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="prevention-protocols" className="space-y-4">
          {preventionProtocols.map((protocol, index) => (
            <Card key={index} className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-400" />
                    {protocol.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
                      {protocol.duration}
                    </Badge>
                    <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
                      {protocol.compliance}% compliance
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {protocol.interventions.map((intervention, idx) => (
                    <div key={idx} className="p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{intervention.name}</span>
                        <Badge 
                          variant={intervention.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {intervention.status === "active" ? "Active" : "Needs Attention"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        {'dosage' in intervention ? intervention.dosage : 
                         'frequency' in intervention ? intervention.frequency :
                         'adherence' in intervention ? intervention.adherence :
                         'target' in intervention ? intervention.target : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-400" />
                  AI Risk Predictions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-green-400 mt-0.5" />
                    <div>
                      <h4 className="text-green-400 font-medium">Cardiovascular Improvement</h4>
                      <p className="text-sm text-gray-300">Your risk has decreased by 8% over the last 3 months due to consistent protocol adherence.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="text-yellow-400 font-medium">Sleep Quality Alert</h4>
                      <p className="text-sm text-gray-300">Poor sleep patterns detected. This may increase Alzheimer's risk by 12%.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Personalized Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <Activity className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-300">Increase Zone 2 cardio to 5x/week</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Consider adding NMN supplementation</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-gray-300">Implement sleep hygiene protocol</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

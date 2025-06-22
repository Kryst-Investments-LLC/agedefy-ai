"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brain, Dna, Target, Zap, Calendar, FileText, Lightbulb, AlertTriangle } from "lucide-react"

const personalizedProtocol = {
  user: {
    age: 35,
    geneticProfile: "ApoE 3/4",
    primaryGoals: ["Cognitive Enhancement", "Cardiovascular Health", "Longevity"],
    riskFactors: ["Family history of Alzheimer's", "High stress job"],
    currentBiomarkers: {
      "NAD+": { value: 45, optimal: 60, unit: "μM" },
      HbA1c: { value: 5.2, optimal: 5.0, unit: "%" },
      CRP: { value: 1.8, optimal: 1.0, unit: "mg/L" },
    },
  },
  aiRecommendations: {
    confidence: 92,
    protocolName: "Cognitive Protection & Longevity Stack",
    compounds: [
      {
        name: "NMN",
        dose: "250mg",
        timing: "Morning with breakfast",
        reasoning: "Low NAD+ levels detected, ApoE 3/4 benefits from NAD+ support",
        priority: "High",
        evidence: "Strong",
      },
      {
        name: "Curcumin (Longvida)",
        dose: "400mg",
        timing: "Evening with dinner",
        reasoning: "Anti-inflammatory for elevated CRP, neuroprotective for ApoE 3/4",
        priority: "High",
        evidence: "Strong",
      },
      {
        name: "Omega-3 (DHA/EPA)",
        dose: "2g",
        timing: "With largest meal",
        reasoning: "Cardiovascular protection, cognitive support for genetic risk",
        priority: "Medium",
        evidence: "Strong",
      },
    ],
    lifestyle: [
      "Intermittent fasting 16:8 (supports autophagy)",
      "HIIT exercise 3x/week (improves insulin sensitivity)",
      "Meditation 10min daily (stress reduction for cortisol)",
      "Sleep optimization 7-8 hours (critical for ApoE 3/4)",
    ],
    monitoring: [
      "Monthly NAD+ testing",
      "Quarterly comprehensive metabolic panel",
      "Annual cognitive assessment",
      "Continuous glucose monitoring for 2 weeks quarterly",
    ],
  },
}

export function AIPersonalization() {
  const [showFullProtocol, setShowFullProtocol] = useState(false)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">AI-Powered Personalized Protocol</h1>
        <p className="text-gray-400 text-lg">
          Your custom longevity protocol based on genetics, biomarkers, and AI analysis
        </p>
      </div>

      {/* User Profile Summary */}
      <Card className="bg-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Dna className="h-5 w-5" />
            Your Longevity Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-white font-medium mb-2">Genetic Profile</h4>
              <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
                {personalizedProtocol.user.geneticProfile}
              </Badge>
              <p className="text-gray-400 text-sm mt-2">
                Moderate Alzheimer's risk, benefits from anti-inflammatory compounds
              </p>
            </div>

            <div>
              <h4 className="text-white font-medium mb-2">Primary Goals</h4>
              <div className="space-y-1">
                {personalizedProtocol.user.primaryGoals.map((goal, idx) => (
                  <Badge key={idx} variant="outline" className="border-teal-500 text-teal-300 mr-1">
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-2">Risk Factors</h4>
              <div className="space-y-1">
                {personalizedProtocol.user.riskFactors.map((risk, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-gray-300 text-sm">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="bg-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Protocol Recommendations
            <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
              {personalizedProtocol.aiRecommendations.confidence}% Confidence
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-blue-500/20 bg-blue-500/10 mb-6">
            <Lightbulb className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              <strong>Protocol: {personalizedProtocol.aiRecommendations.protocolName}</strong>
              <br />
              Customized based on your ApoE 3/4 status, current biomarkers, and longevity goals.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h4 className="text-white font-medium">Recommended Compounds</h4>
            {personalizedProtocol.aiRecommendations.compounds.map((compound, idx) => (
              <div key={idx} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h5 className="text-white font-medium">{compound.name}</h5>
                    <p className="text-teal-400 text-sm">
                      {compound.dose} - {compound.timing}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      className={
                        compound.priority === "High"
                          ? "bg-red-600/20 text-red-300 border-red-500/20"
                          : "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
                      }
                    >
                      {compound.priority} Priority
                    </Badge>
                    <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
                      {compound.evidence} Evidence
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{compound.reasoning}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Biomarkers */}
      <Card className="bg-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            Biomarker Optimization Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(personalizedProtocol.user.currentBiomarkers).map(([name, data]) => (
              <div key={name} className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">{name}</h4>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">
                    Current: {data.value} {data.unit}
                  </span>
                  <span className="text-teal-400">
                    Target: {data.optimal} {data.unit}
                  </span>
                </div>
                <Progress value={(data.value / data.optimal) * 100} className="w-full" />
                <p className="text-xs text-gray-500 mt-2">
                  {data.value < data.optimal ? "Below optimal - protocol will help improve" : "At/above target"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button className="bg-teal-600 hover:bg-teal-700">
          <Zap className="h-4 w-4 mr-2" />
          Start This Protocol
        </Button>
        <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Lab Tests
        </Button>
        <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
          <FileText className="h-4 w-4 mr-2" />
          Consult with Doctor
        </Button>
      </div>
    </div>
  )
}

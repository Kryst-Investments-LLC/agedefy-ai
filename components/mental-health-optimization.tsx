"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Heart, Smile, TrendingUp, Moon, Sun, Activity, Zap } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function MentalHealthOptimization() {
  const { t } = useTranslation()
  const [selectedMetric, setSelectedMetric] = useState("mood")

  const mentalHealthMetrics = [
    {
      id: "mood",
      name: "Mood Score",
      value: 7.8,
      max: 10,
      trend: "up",
      status: "good",
      description: "Overall emotional well-being"
    },
    {
      id: "stress",
      name: "Stress Level",
      value: 3.2,
      max: 10,
      trend: "down",
      status: "optimal",
      description: "Current stress indicators"
    },
    {
      id: "anxiety",
      name: "Anxiety Score",
      value: 2.1,
      max: 10,
      trend: "stable",
      status: "excellent",
      description: "Anxiety level assessment"
    },
    {
      id: "focus",
      name: "Focus Quality",
      value: 8.5,
      max: 10,
      trend: "up",
      status: "excellent",
      description: "Cognitive focus and attention"
    },
    {
      id: "energy",
      name: "Mental Energy",
      value: 6.9,
      max: 10,
      trend: "stable",
      status: "good",
      description: "Mental vitality and alertness"
    },
    {
      id: "sleep-quality",
      name: "Sleep Quality",
      value: 8.2,
      max: 10,
      trend: "up",
      status: "excellent",
      description: "Sleep impact on mental health"
    }
  ]

  const interventions = [
    {
      name: "Mindfulness Meditation",
      type: "Daily Practice",
      duration: "10 min",
      frequency: "2x daily",
      effectiveness: 92,
      status: "active",
      benefits: ["Stress reduction", "Improved focus", "Emotional regulation"]
    },
    {
      name: "Cognitive Behavioral Therapy",
      type: "Therapy Session",
      duration: "50 min",
      frequency: "Weekly",
      effectiveness: 88,
      status: "scheduled",
      benefits: ["Thought pattern improvement", "Anxiety management", "Coping strategies"]
    },
    {
      name: "Breathwork Exercise",
      type: "Breathing Technique",
      duration: "5 min",
      frequency: "As needed",
      effectiveness: 85,
      status: "active",
      benefits: ["Immediate stress relief", "Anxiety reduction", "Improved focus"]
    },
    {
      name: "Nature Exposure",
      type: "Outdoor Activity",
      duration: "30 min",
      frequency: "Daily",
      effectiveness: 78,
      status: "active",
      benefits: ["Mood enhancement", "Stress reduction", "Vitamin D synthesis"]
    }
  ]

  const aiInsights = [
    {
      type: "pattern",
      title: "Sleep-Mood Correlation",
      description: "Your mood scores are 23% higher on days with 8+ hours of sleep",
      recommendation: "Maintain consistent 8-hour sleep schedule",
      priority: "high"
    },
    {
      type: "trigger",
      title: "Stress Spike Detection",
      description: "Stress levels increase 40% during afternoon meetings",
      recommendation: "Schedule 5-minute breathing breaks before meetings",
      priority: "medium"
    },
    {
      type: "optimization",
      title: "Focus Enhancement",
      description: "Morning meditation sessions improve focus scores by 15%",
      recommendation: "Continue morning mindfulness practice",
      priority: "low"
    }
  ]

  const moodJournal = [
    { date: "2024-12-20", mood: 8, energy: 7, stress: 3, notes: "Great day, productive work session" },
    { date: "2024-12-19", mood: 6, energy: 5, stress: 6, notes: "Feeling overwhelmed with deadlines" },
    { date: "2024-12-18", mood: 9, energy: 8, stress: 2, notes: "Excellent sleep, morning meditation helped" },
    { date: "2024-12-17", mood: 7, energy: 6, stress: 4, notes: "Balanced day, good social connections" }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent": return "text-green-400"
      case "good": return "text-blue-400"
      case "optimal": return "text-green-400"
      case "warning": return "text-yellow-400"
      default: return "text-gray-400"
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-400" />
      case "down": return <TrendingUp className="h-4 w-4 text-red-400 rotate-180" />
      default: return <div className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-600/20 text-red-300 border-red-500/20"
      case "medium": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "low": return "bg-green-600/20 text-green-300 border-green-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Mental Health Optimization</h2>
        <p className="text-gray-400">AI-powered mental wellness tracking and intervention</p>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="metrics" className="text-gray-300">Mental Metrics</TabsTrigger>
          <TabsTrigger value="interventions" className="text-gray-300">Interventions</TabsTrigger>
          <TabsTrigger value="insights" className="text-gray-300">AI Insights</TabsTrigger>
          <TabsTrigger value="journal" className="text-gray-300">Mood Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentalHealthMetrics.map((metric) => (
              <Card 
                key={metric.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedMetric === metric.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedMetric(metric.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {metric.id === "mood" && <Smile className="h-5 w-5 text-yellow-400" />}
                      {metric.id === "stress" && <Zap className="h-5 w-5 text-red-400" />}
                      {metric.id === "anxiety" && <Heart className="h-5 w-5 text-purple-400" />}
                      {metric.id === "focus" && <Brain className="h-5 w-5 text-blue-400" />}
                      {metric.id === "energy" && <Activity className="h-5 w-5 text-green-400" />}
                      {metric.id === "sleep-quality" && <Moon className="h-5 w-5 text-indigo-400" />}
                      {metric.name}
                    </CardTitle>
                    {getTrendIcon(metric.trend)}
                  </div>
                  <CardDescription className="text-gray-400">
                    {metric.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-white">
                        {metric.value}
                      </span>
                      <span className="text-gray-400">/ {metric.max}</span>
                    </div>
                    <Progress value={(metric.value / metric.max) * 100} className="h-2" />
                    <Badge className={`${getStatusColor(metric.status)} bg-transparent border-current`}>
                      {metric.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="interventions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interventions.map((intervention, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{intervention.name}</CardTitle>
                    <Badge className={intervention.status === "active" ? "bg-green-600/20 text-green-300 border-green-500/20" : "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"}>
                      {intervention.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {intervention.type}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration</span>
                      <span className="text-white">{intervention.duration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Frequency</span>
                      <span className="text-white">{intervention.frequency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Effectiveness</span>
                      <span className="text-green-400">{intervention.effectiveness}%</span>
                    </div>
                    
                    <div>
                      <h4 className="text-gray-300 text-sm font-medium mb-2">Benefits</h4>
                      <div className="space-y-1">
                        {intervention.benefits.map((benefit, idx) => (
                          <div key={idx} className="text-xs text-gray-400">• {benefit}</div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      variant={intervention.status === "active" ? "outline" : "default"}
                      className="w-full"
                    >
                      {intervention.status === "active" ? "Manage" : "Start"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="space-y-4">
            {aiInsights.map((insight, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      {insight.title}
                    </CardTitle>
                    <Badge className={getPriorityColor(insight.priority)}>
                      {insight.priority} priority
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-3">{insight.description}</p>
                  <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-1">Recommendation</h4>
                    <p className="text-gray-300 text-sm">{insight.recommendation}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="journal" className="space-y-4">
          <div className="space-y-4">
            {moodJournal.map((entry, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white">{entry.date}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">{entry.mood}</div>
                      <p className="text-gray-400 text-sm">Mood</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{entry.energy}</div>
                      <p className="text-gray-400 text-sm">Energy</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{entry.stress}</div>
                      <p className="text-gray-400 text-sm">Stress</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="text-gray-300 font-medium mb-1">Notes</h4>
                    <p className="text-gray-400 text-sm">{entry.notes}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

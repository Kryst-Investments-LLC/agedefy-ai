"use client"

import {
  MessageSquare,
  TrendingUp,
  Users,
  Brain,
  Target,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  BookOpen,
  Settings,
} from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const feedbackChannels = [
  {
    channel: "User Feedback",
    description: "Direct user input and satisfaction surveys",
    volume: 2847,
    responseRate: 89,
    avgRating: 4.6,
    status: "active",
    icon: MessageSquare,
    insights: [
      "94% users find AI recommendations helpful",
      "Request for more personalized workout plans",
      "Positive feedback on multi-language support",
    ],
  },
  {
    channel: "Scientific Updates",
    description: "Latest research integration and validation",
    volume: 156,
    responseRate: 100,
    avgRating: 4.8,
    status: "active",
    icon: BookOpen,
    insights: [
      "15 new longevity studies integrated this month",
      "Updated NAD+ research recommendations",
      "New biomarker correlation discoveries",
    ],
  },
  {
    channel: "AI Performance",
    description: "Machine learning model performance monitoring",
    volume: 45000,
    responseRate: 100,
    avgRating: 4.7,
    status: "active",
    icon: Brain,
    insights: [
      "Recommendation accuracy improved to 94.2%",
      "Reduced false positive rate by 12%",
      "Enhanced multi-AI consensus algorithm",
    ],
  },
  {
    channel: "Health Outcomes",
    description: "User health improvement tracking and analysis",
    volume: 1234,
    responseRate: 76,
    avgRating: 4.5,
    status: "active",
    icon: TrendingUp,
    insights: [
      "Average biomarker improvement: 23%",
      "User adherence rate: 78%",
      "Positive health outcomes in 89% of users",
    ],
  },
]

const improvementCycles = [
  {
    cycle: "Weekly AI Updates",
    frequency: "Every 7 days",
    lastUpdate: "2024-12-20",
    improvements: 12,
    status: "active",
    description: "Continuous AI model refinement based on user interactions",
    metrics: {
      accuracy: "+2.3%",
      speed: "+15%",
      satisfaction: "+0.2 points",
    },
  },
  {
    cycle: "Monthly Research Integration",
    frequency: "Every 30 days",
    lastUpdate: "2024-12-15",
    improvements: 8,
    status: "active",
    description: "Integration of latest scientific research and clinical studies",
    metrics: {
      papers: "+156 studies",
      recommendations: "+23 new",
      validation: "98.7% accuracy",
    },
  },
  {
    cycle: "Quarterly Feature Updates",
    frequency: "Every 90 days",
    lastUpdate: "2024-12-01",
    improvements: 5,
    status: "active",
    description: "Major feature releases based on user feedback and market needs",
    metrics: {
      features: "+5 major",
      userSatisfaction: "+0.4 points",
      retention: "+12%",
    },
  },
]

const feedbackMetrics = [
  { metric: "User Satisfaction", value: 4.6, target: 4.8, unit: "/5", trend: "+0.2" },
  { metric: "Response Rate", value: 89, target: 95, unit: "%", trend: "+5%" },
  { metric: "Implementation Rate", value: 78, target: 85, unit: "%", trend: "+8%" },
  { metric: "Time to Resolution", value: 2.3, target: 2.0, unit: " days", trend: "-0.5" },
]

const recentImprovements = [
  {
    date: "2024-12-20",
    category: "AI Enhancement",
    improvement: "Enhanced multi-AI consensus algorithm",
    impact: "Improved recommendation accuracy by 2.3%",
    userFeedback: "Positive",
    status: "deployed",
  },
  {
    date: "2024-12-18",
    category: "User Experience",
    improvement: "Added Hindi language support",
    impact: "Expanded addressable market by 1.4B users",
    userFeedback: "Excellent",
    status: "deployed",
  },
  {
    date: "2024-12-15",
    category: "Research Integration",
    improvement: "Integrated 15 new longevity studies",
    impact: "Updated recommendations for 23% of users",
    userFeedback: "Very Positive",
    status: "deployed",
  },
  {
    date: "2024-12-12",
    category: "Performance",
    improvement: "Optimized database queries",
    impact: "Reduced response time by 15%",
    userFeedback: "Positive",
    status: "deployed",
  },
  {
    date: "2024-12-10",
    category: "Security",
    improvement: "Enhanced encryption protocols",
    impact: "Improved security score to 97.8%",
    userFeedback: "Neutral",
    status: "deployed",
  },
]

export function FeedbackLoopSystem() {
  const [selectedTab, setSelectedTab] = useState("overview")

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Feedback Loop System</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Continuous improvement through user feedback, scientific updates, and AI performance monitoring
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {feedbackMetrics.map((metric, index) => (
            <Card key={index} className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Target className="h-8 w-8 text-teal-400" />
                  <Badge className="bg-green-600/20 text-green-300">
                    {metric.trend}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {metric.value}{metric.unit}
                </div>
                <div className="text-sm text-gray-400 mb-2">{metric.metric}</div>
                <div className="text-xs text-gray-500">
                  Target: {metric.target}{metric.unit}
                </div>
                <Progress 
                  value={(metric.value / metric.target) * 100} 
                  className="h-2 mt-2" 
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-12">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="channels">Feedback Channels</TabsTrigger>
            <TabsTrigger value="cycles">Improvement Cycles</TabsTrigger>
            <TabsTrigger value="recent">Recent Changes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {feedbackChannels.map((channel, index) => {
                const ChannelIcon = channel.icon
                return (
                  <Card key={index} className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-teal-600/20">
                          <ChannelIcon className="h-5 w-5 text-teal-400" />
                        </div>
                        <div>
                          <CardTitle className="text-white">{channel.channel}</CardTitle>
                          <CardDescription>{channel.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">{channel.volume.toLocaleString()}</div>
                          <div className="text-xs text-gray-400">Volume</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">{channel.responseRate}%</div>
                          <div className="text-xs text-gray-400">Response</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">{channel.avgRating}/5</div>
                          <div className="text-xs text-gray-400">Rating</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-300">Key Insights:</h4>
                        {channel.insights.map((insight, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                            <div className="w-1 h-1 bg-teal-400 rounded-full" />
                            {insight}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="channels" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {feedbackChannels.map((channel, index) => {
                const ChannelIcon = channel.icon
                return (
                  <Card key={index} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-teal-600/20">
                            <ChannelIcon className="h-6 w-6 text-teal-400" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">{channel.channel}</h3>
                            <p className="text-gray-400">{channel.description}</p>
                          </div>
                        </div>
                        <Badge className="bg-green-600/20 text-green-300">{channel.status}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                          <div className="text-2xl font-bold text-white mb-1">{channel.volume.toLocaleString()}</div>
                          <div className="text-sm text-gray-400">Total Volume</div>
                        </div>
                        <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                          <div className="text-2xl font-bold text-white mb-1">{channel.responseRate}%</div>
                          <div className="text-sm text-gray-400">Response Rate</div>
                        </div>
                        <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                          <div className="text-2xl font-bold text-white mb-1">{channel.avgRating}/5</div>
                          <div className="text-sm text-gray-400">Average Rating</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-white font-medium mb-3">Recent Insights & Actions:</h4>
                        <div className="space-y-3">
                          {channel.insights.map((insight, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-700/30 rounded-lg">
                              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-300 text-sm">{insight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="cycles" className="space-y-6">
            <div className="space-y-6">
              {improvementCycles.map((cycle, index) => (
                <Card key={index} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{cycle.cycle}</h3>
                        <p className="text-gray-400">{cycle.description}</p>
                      </div>
                      <Badge className="bg-green-600/20 text-green-300">{cycle.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                        <Clock className="h-5 w-5 text-teal-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">{cycle.frequency}</div>
                        <div className="text-xs text-gray-400">Frequency</div>
                      </div>
                      <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-sm font-medium text-white">{cycle.lastUpdate}</div>
                        <div className="text-xs text-gray-400">Last Update</div>
                      </div>
                      <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-sm font-medium text-white">{cycle.improvements}</div>
                        <div className="text-xs text-gray-400">Improvements</div>
                      </div>
                      <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-400 mx-auto mb-2" />
                        <div className="text-xs text-gray-400">Active</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-3">Recent Metrics:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(cycle.metrics).map(([key, value], idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-teal-600/10 rounded-lg">
                            <span className="text-gray-300 capitalize">{key}</span>
                            <span className="text-teal-400 font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="space-y-6">
            <div className="space-y-4">
              {recentImprovements.map((improvement, index) => (
                <Card key={index} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-400">{improvement.date}</div>
                        <Badge className="bg-blue-600/20 text-blue-300">
                          {improvement.category}
                        </Badge>
                      </div>
                      <Badge 
                        className={
                          improvement.status === 'deployed' 
                            ? "bg-green-600/20 text-green-300" 
                            : "bg-yellow-600/20 text-yellow-300"
                        }
                      >
                        {improvement.status}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-white font-semibold mb-2">{improvement.improvement}</h3>
                      <p className="text-gray-400 text-sm mb-2">{improvement.impact}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">User Feedback:</span>
                        <Badge 
                          className={
                            improvement.userFeedback === 'Excellent' || improvement.userFeedback === 'Very Positive'
                              ? "bg-green-600/20 text-green-300"
                              : improvement.userFeedback === 'Positive'
                              ? "bg-blue-600/20 text-blue-300"
                              : "bg-gray-600/20 text-gray-300"
                          }
                        >
                          {improvement.userFeedback}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center">
          <Card className="bg-gradient-to-r from-purple-600/20 to-teal-600/20 border-purple-500/20">
            <CardContent className="p-8">
              <Settings className="h-12 w-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Continuous Improvement</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Our feedback loop system ensures constant evolution based on user needs, scientific advances, and AI performance optimization
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Submit Feedback
                </Button>
                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white">
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

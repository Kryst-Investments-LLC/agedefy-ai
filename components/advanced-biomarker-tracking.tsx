"use client"

import { Activity, Watch, Heart, Brain, Zap, TrendingUp, AlertTriangle } from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "@/lib/i18n/context"

export function AdvancedBiomarkerTracking() {
  const [connectedDevices] = useState([
    { name: "Apple Watch Series 9", type: "smartwatch", connected: true, battery: 85 },
    { name: "Oura Ring Gen 3", type: "ring", connected: true, battery: 72 },
    { name: "Continuous Glucose Monitor", type: "cgm", connected: false, battery: 0 },
    { name: "WHOOP 4.0", type: "fitness", connected: true, battery: 91 }
  ])

  const biomarkers = [
    { name: "Heart Rate Variability", value: 42, unit: "ms", status: "optimal", trend: "up" },
    { name: "Resting Heart Rate", value: 58, unit: "bpm", status: "good", trend: "stable" },
    { name: "Blood Glucose", value: 95, unit: "mg/dL", status: "normal", trend: "down" },
    { name: "Sleep Score", value: 87, unit: "%", status: "excellent", trend: "up" },
    { name: "Recovery Score", value: 78, unit: "%", status: "good", trend: "up" },
    { name: "Stress Level", value: 23, unit: "%", status: "low", trend: "down" }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": case "excellent": return "text-green-400"
      case "good": case "normal": return "text-blue-400"
      case "low": return "text-yellow-400"
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Advanced Biomarker Tracking</h2>
        <p className="text-gray-400">Integrate with wearables for real-time health insights</p>
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="devices" className="text-gray-300">Connected Devices</TabsTrigger>
          <TabsTrigger value="biomarkers" className="text-gray-300">Live Biomarkers</TabsTrigger>
          <TabsTrigger value="insights" className="text-gray-300">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedDevices.map((device, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {device.type === "smartwatch" && <Watch className="h-5 w-5 text-blue-400" />}
                      {device.type === "ring" && <Zap className="h-5 w-5 text-purple-400" />}
                      {device.type === "cgm" && <Activity className="h-5 w-5 text-green-400" />}
                      {device.type === "fitness" && <Heart className="h-5 w-5 text-red-400" />}
                      {device.name}
                    </CardTitle>
                    <Badge variant={device.connected ? "default" : "secondary"}>
                      {device.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {device.connected && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Battery</span>
                        <span className="text-white">{device.battery}%</span>
                      </div>
                      <Progress value={device.battery} className="h-2" />
                    </div>
                  )}
                  {!device.connected && (
                    <Button variant="outline" size="sm" className="w-full">
                      Connect Device
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="biomarkers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {biomarkers.map((biomarker, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">{biomarker.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-white">
                        {biomarker.value}
                      </span>
                      <span className="text-sm text-gray-400">{biomarker.unit}</span>
                    </div>
                    {getTrendIcon(biomarker.trend)}
                  </div>
                  <Badge className={`${getStatusColor(biomarker.status)} bg-transparent border-current`}>
                    {biomarker.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-400" />
                  AI Health Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-green-400 mt-0.5" />
                    <div>
                      <h4 className="text-green-400 font-medium">Excellent Recovery</h4>
                      <p className="text-sm text-gray-300">Your HRV and sleep quality indicate optimal recovery. Consider maintaining current routine.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="text-yellow-400 font-medium">Stress Management</h4>
                      <p className="text-sm text-gray-300">Stress levels are manageable but consider meditation or breathing exercises.</p>
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
                  <Heart className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-gray-300">Optimize sleep schedule for better HRV</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <Activity className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-300">Increase Zone 2 cardio by 15 minutes</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-gray-300">Consider magnesium supplementation</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

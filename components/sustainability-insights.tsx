"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Leaf, Recycle, Droplets, Zap, TreePine, Globe, TrendingUp, Award } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function SustainabilityInsights() {
  const { t } = useTranslation()
  const [selectedMetric, setSelectedMetric] = useState("carbon-footprint")

  const sustainabilityMetrics = [
    {
      id: "carbon-footprint",
      name: "Carbon Footprint",
      value: 2.3,
      unit: "tons CO2/year",
      target: 1.5,
      trend: "down",
      status: "improving",
      description: "Your annual carbon emissions from health activities"
    },
    {
      id: "water-usage",
      name: "Water Conservation",
      value: 85,
      unit: "% efficiency",
      target: 90,
      trend: "up",
      status: "good",
      description: "Water usage efficiency in health routines"
    },
    {
      id: "waste-reduction",
      name: "Waste Reduction",
      value: 78,
      unit: "% recycled",
      target: 85,
      trend: "up",
      status: "good",
      description: "Percentage of health-related waste recycled"
    },
    {
      id: "energy-efficiency",
      name: "Energy Efficiency",
      value: 92,
      unit: "% renewable",
      target: 100,
      trend: "stable",
      status: "excellent",
      description: "Renewable energy usage for health devices"
    }
  ]

  const ecoFriendlyProducts = [
    {
      name: "Bamboo Supplement Bottles",
      category: "Packaging",
      impact: "65% less plastic",
      cost: "$12.99",
      sustainability: 95,
      certifications: ["Biodegradable", "Carbon Neutral"]
    },
    {
      name: "Solar-Powered Wearables",
      category: "Devices",
      impact: "Zero charging emissions",
      cost: "$299.99",
      sustainability: 88,
      certifications: ["Energy Star", "RoHS Compliant"]
    },
    {
      name: "Organic Lab Testing",
      category: "Services",
      impact: "50% less chemical waste",
      cost: "$89.99",
      sustainability: 82,
      certifications: ["Organic Certified", "Green Chemistry"]
    },
    {
      name: "Plant-Based Supplements",
      category: "Nutrition",
      impact: "80% lower carbon footprint",
      cost: "$34.99",
      sustainability: 91,
      certifications: ["Vegan", "Sustainable Sourcing"]
    }
  ]

  const carbonOffsetProjects = [
    {
      name: "Reforestation Initiative",
      location: "Amazon Rainforest",
      impact: "500 trees planted",
      cost: "$25/month",
      verified: true,
      progress: 78
    },
    {
      name: "Renewable Energy Farm",
      location: "Costa Rica",
      impact: "2.5 MWh clean energy",
      cost: "$15/month",
      verified: true,
      progress: 92
    },
    {
      name: "Ocean Cleanup Project",
      location: "Pacific Ocean",
      impact: "100kg plastic removed",
      cost: "$20/month",
      verified: true,
      progress: 65
    }
  ]

  const sustainabilityGoals = [
    {
      goal: "Carbon Neutral Health Routine",
      progress: 68,
      target: "2025",
      actions: ["Switch to renewable energy", "Use eco-friendly products", "Offset remaining emissions"]
    },
    {
      goal: "Zero Waste Supplements",
      progress: 45,
      target: "2024",
      actions: ["Bulk purchasing", "Refillable containers", "Compostable packaging"]
    },
    {
      goal: "Sustainable Transportation",
      progress: 82,
      target: "2024",
      actions: ["Walk to appointments", "Electric vehicle", "Public transport"]
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent": return "text-green-400"
      case "good": return "text-blue-400"
      case "improving": return "text-yellow-400"
      case "needs-attention": return "text-red-400"
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

  const getSustainabilityColor = (score: number) => {
    if (score >= 90) return "text-green-400"
    if (score >= 75) return "text-blue-400"
    if (score >= 60) return "text-yellow-400"
    return "text-red-400"
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Sustainability Insights</h2>
        <p className="text-gray-400">Track and optimize your environmental impact on health</p>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="metrics" className="text-gray-300">Eco Metrics</TabsTrigger>
          <TabsTrigger value="products" className="text-gray-300">Green Products</TabsTrigger>
          <TabsTrigger value="offsets" className="text-gray-300">Carbon Offsets</TabsTrigger>
          <TabsTrigger value="goals" className="text-gray-300">Sustainability Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sustainabilityMetrics.map((metric) => (
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
                      {metric.id === "carbon-footprint" && <Globe className="h-5 w-5 text-blue-400" />}
                      {metric.id === "water-usage" && <Droplets className="h-5 w-5 text-blue-400" />}
                      {metric.id === "waste-reduction" && <Recycle className="h-5 w-5 text-green-400" />}
                      {metric.id === "energy-efficiency" && <Zap className="h-5 w-5 text-yellow-400" />}
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
                      <span className="text-gray-400">{metric.unit}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Target: {metric.target} {metric.unit}</span>
                    </div>
                    <Progress value={(metric.value / metric.target) * 100} className="h-2" />
                    <Badge className={`${getStatusColor(metric.status)} bg-transparent border-current`}>
                      {metric.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ecoFriendlyProducts.map((product, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-green-400" />
                      {product.name}
                    </CardTitle>
                    <Badge variant="secondary">{product.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Environmental Impact</span>
                      <span className="text-green-400">{product.impact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price</span>
                      <span className="text-white">{product.cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sustainability Score</span>
                      <span className={`font-bold ${getSustainabilityColor(product.sustainability)}`}>
                        {product.sustainability}/100
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-gray-300 text-sm font-medium mb-2">Certifications</h4>
                      <div className="flex flex-wrap gap-1">
                        {product.certifications.map((cert, idx) => (
                          <Badge key={idx} className="bg-green-600/20 text-green-300 border-green-500/20 text-xs">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      Choose Sustainable Option
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="offsets" className="space-y-4">
          <div className="space-y-4">
            {carbonOffsetProjects.map((project, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <TreePine className="h-5 w-5 text-green-400" />
                      {project.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {project.verified && (
                        <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
                          Verified
                        </Badge>
                      )}
                      <span className="text-gray-400">{project.cost}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400">Location: </span>
                        <span className="text-white">{project.location}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Impact: </span>
                        <span className="text-green-400">{project.impact}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Project Progress</span>
                        <span className="text-white">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>

                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      Support This Project
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <div className="space-y-4">
            {sustainabilityGoals.map((goal, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-400" />
                      {goal.goal}
                    </CardTitle>
                    <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
                      Target: {goal.target}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white">{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                    </div>

                    <div>
                      <h4 className="text-gray-300 font-medium mb-2">Action Items</h4>
                      <div className="space-y-2">
                        {goal.actions.map((action, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span className="text-sm text-gray-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
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

"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, LineChart, PieChart, TrendingUp, Download, Share, Filter, Eye } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function AdvancedDataVisualization() {
  const { t } = useTranslation()
  const [selectedChart, setSelectedChart] = useState("biomarker-trends")

  const visualizationTypes = [
    {
      id: "biomarker-trends",
      name: "Biomarker Trends",
      type: "Line Chart",
      description: "Track biomarker changes over time",
      dataPoints: 156,
      timeRange: "6 months",
      insights: ["HbA1c improving", "Vitamin D stable", "Inflammation decreasing"]
    },
    {
      id: "health-correlations",
      name: "Health Correlations",
      type: "Scatter Plot",
      description: "Discover relationships between health metrics",
      dataPoints: 89,
      timeRange: "3 months",
      insights: ["Sleep affects HRV", "Exercise improves mood", "Stress impacts glucose"]
    },
    {
      id: "supplement-effectiveness",
      name: "Supplement Effectiveness",
      type: "Bar Chart",
      description: "Compare supplement impact on biomarkers",
      dataPoints: 45,
      timeRange: "12 weeks",
      insights: ["Omega-3 most effective", "Vitamin D showing results", "Magnesium improving sleep"]
    },
    {
      id: "longevity-score",
      name: "Longevity Score Breakdown",
      type: "Pie Chart",
      description: "Analyze factors contributing to longevity score",
      dataPoints: 12,
      timeRange: "Current",
      insights: ["Nutrition: 85%", "Exercise: 78%", "Sleep: 92%"]
    }
  ]

  const dashboardWidgets = [
    {
      title: "Health Score Trend",
      value: "87/100",
      change: "+5%",
      trend: "up",
      chartType: "line",
      color: "green"
    },
    {
      title: "Biomarker Alerts",
      value: "2 Active",
      change: "-1",
      trend: "down",
      chartType: "alert",
      color: "yellow"
    },
    {
      title: "Protocol Adherence",
      value: "94%",
      change: "+2%",
      trend: "up",
      chartType: "progress",
      color: "blue"
    },
    {
      title: "Risk Factors",
      value: "Low",
      change: "Stable",
      trend: "stable",
      chartType: "gauge",
      color: "green"
    }
  ]

  const interactiveFeatures = [
    {
      name: "Time Range Selector",
      description: "Adjust visualization timeframes from days to years",
      enabled: true
    },
    {
      name: "Multi-Metric Overlay",
      description: "Compare multiple biomarkers on single chart",
      enabled: true
    },
    {
      name: "Predictive Modeling",
      description: "AI-powered future health projections",
      enabled: true
    },
    {
      name: "Correlation Analysis",
      description: "Automatic discovery of health metric relationships",
      enabled: true
    },
    {
      name: "Export & Sharing",
      description: "Download charts or share with healthcare providers",
      enabled: true
    },
    {
      name: "Real-time Updates",
      description: "Live data streaming from connected devices",
      enabled: false
    }
  ]

  const customReports = [
    {
      name: "Monthly Health Summary",
      type: "Comprehensive Report",
      lastGenerated: "2024-12-20",
      pages: 12,
      sections: ["Biomarkers", "Lifestyle", "Recommendations", "Trends"]
    },
    {
      name: "Supplement Efficacy Analysis",
      type: "Focused Report",
      lastGenerated: "2024-12-18",
      pages: 6,
      sections: ["Before/After", "Statistical Analysis", "Cost-Benefit"]
    },
    {
      name: "Longevity Risk Assessment",
      type: "Predictive Report",
      lastGenerated: "2024-12-15",
      pages: 8,
      sections: ["Risk Factors", "Projections", "Interventions", "Timeline"]
    }
  ]

  const getChartIcon = (type: string) => {
    switch (type) {
      case "Line Chart": return <LineChart className="h-5 w-5 text-blue-400" />
      case "Bar Chart": return <BarChart className="h-5 w-5 text-green-400" />
      case "Pie Chart": return <PieChart className="h-5 w-5 text-purple-400" />
      case "Scatter Plot": return <TrendingUp className="h-5 w-5 text-yellow-400" />
      default: return <BarChart className="h-5 w-5 text-gray-400" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up": return "text-green-400"
      case "down": return "text-red-400"
      case "stable": return "text-gray-400"
      default: return "text-gray-400"
    }
  }

  const getWidgetColor = (color: string) => {
    switch (color) {
      case "green": return "text-green-400"
      case "blue": return "text-blue-400"
      case "yellow": return "text-yellow-400"
      case "red": return "text-red-400"
      default: return "text-gray-400"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Advanced Data Visualization</h2>
        <p className="text-gray-400">Interactive charts and insights for your health data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {dashboardWidgets.map((widget, index) => (
          <Card key={index} className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-400 text-sm">{widget.title}</h3>
                <TrendingUp className={`h-4 w-4 ${getTrendColor(widget.trend)} ${widget.trend === "down" ? "rotate-180" : ""}`} />
              </div>
              <div className={`text-2xl font-bold ${getWidgetColor(widget.color)} mb-1`}>
                {widget.value}
              </div>
              <div className={`text-sm ${getTrendColor(widget.trend)}`}>
                {widget.change}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="visualizations" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="visualizations" className="text-gray-300">Visualizations</TabsTrigger>
          <TabsTrigger value="interactive" className="text-gray-300">Interactive Features</TabsTrigger>
          <TabsTrigger value="reports" className="text-gray-300">Custom Reports</TabsTrigger>
          <TabsTrigger value="analytics" className="text-gray-300">Advanced Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="visualizations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visualizationTypes.map((viz) => (
              <Card 
                key={viz.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedChart === viz.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedChart(viz.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {getChartIcon(viz.type)}
                      {viz.name}
                    </CardTitle>
                    <Badge variant="secondary">{viz.type}</Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {viz.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Data Points: </span>
                        <span className="text-white">{viz.dataPoints}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Time Range: </span>
                        <span className="text-white">{viz.timeRange}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-gray-300 text-sm font-medium mb-2">Key Insights</h4>
                      <div className="space-y-1">
                        {viz.insights.map((insight, index) => (
                          <div key={index} className="text-xs text-gray-400">• {insight}</div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                        <Eye className="h-4 w-4 mr-1" />
                        View Chart
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="interactive" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interactiveFeatures.map((feature, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{feature.name}</CardTitle>
                    <Badge className={feature.enabled ? "bg-green-600/20 text-green-300 border-green-500/20" : "bg-gray-600/20 text-gray-300 border-gray-500/20"}>
                      {feature.enabled ? "Enabled" : "Coming Soon"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">{feature.description}</p>
                  <Button 
                    variant={feature.enabled ? "default" : "outline"}
                    className={`w-full ${feature.enabled ? 'bg-teal-600 hover:bg-teal-700' : 'cursor-not-allowed'}`}
                    disabled={!feature.enabled}
                  >
                    {feature.enabled ? "Configure" : "Notify When Available"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="mb-4">
            <Button className="bg-teal-600 hover:bg-teal-700">
              Generate New Report
            </Button>
          </div>
          
          <div className="space-y-4">
            {customReports.map((report, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{report.name}</CardTitle>
                    <Badge variant="secondary">{report.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-gray-400">Last Generated: </span>
                      <span className="text-white">{report.lastGenerated}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Pages: </span>
                      <span className="text-white">{report.pages}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Sections: </span>
                      <span className="text-white">{report.sections.length}</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-gray-300 text-sm font-medium mb-2">Report Sections</h4>
                    <div className="flex flex-wrap gap-1">
                      {report.sections.map((section, idx) => (
                        <Badge key={idx} className="bg-blue-600/20 text-blue-300 border-blue-500/20 text-xs">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                      View Report
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Predictive Analytics</CardTitle>
                <CardDescription className="text-gray-400">
                  AI-powered health predictions and risk assessments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <h4 className="text-blue-400 font-medium mb-2">Cardiovascular Risk</h4>
                  <p className="text-gray-300 text-sm">Based on current trends, your 10-year cardiovascular risk is projected to decrease by 15%</p>
                </div>
                <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <h4 className="text-green-400 font-medium mb-2">Longevity Projection</h4>
                  <p className="text-gray-300 text-sm">Current protocol may extend healthy lifespan by 8-12 years</p>
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <h4 className="text-yellow-400 font-medium mb-2">Optimization Opportunity</h4>
                  <p className="text-gray-300 text-sm">Sleep quality improvements could boost overall health score by 12%</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Statistical Analysis</CardTitle>
                <CardDescription className="text-gray-400">
                  Advanced statistical insights from your health data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Data Completeness</span>
                    <span className="text-green-400">94%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trend Confidence</span>
                    <span className="text-blue-400">87%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Correlation Strength</span>
                    <span className="text-purple-400">0.73</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prediction Accuracy</span>
                    <span className="text-yellow-400">91%</span>
                  </div>
                </div>
                
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Advanced Filters
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

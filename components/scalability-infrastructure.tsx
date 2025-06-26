"use client"

import {
  Server,
  Globe,
  Users,
  Database,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  BarChart3,
  Settings,
  Cloud,
  Network,
} from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const infrastructureMetrics = [
  {
    metric: "Global CDN Coverage",
    value: "99.9%",
    status: "optimal",
    description: "Content delivery across 180+ edge locations",
    icon: Globe,
  },
  {
    metric: "Auto-scaling Capacity",
    value: "10M+",
    status: "ready",
    description: "Concurrent users supported with auto-scaling",
    icon: Users,
  },
  {
    metric: "Database Performance",
    value: "< 50ms",
    status: "optimal",
    description: "Average query response time globally",
    icon: Database,
  },
  {
    metric: "API Response Time",
    value: "< 200ms",
    status: "optimal",
    description: "99th percentile API response time",
    icon: Zap,
  },
]

const scalabilityFeatures = [
  {
    category: "Infrastructure Scaling",
    features: [
      {
        name: "Auto-scaling Groups",
        description: "Automatic horizontal scaling based on demand",
        status: "active",
        capacity: "1-1000 instances",
        icon: Server,
      },
      {
        name: "Load Balancing",
        description: "Intelligent traffic distribution across regions",
        status: "active",
        capacity: "Multi-region",
        icon: Network,
      },
      {
        name: "Database Sharding",
        description: "Horizontal database partitioning for scale",
        status: "active",
        capacity: "Unlimited",
        icon: Database,
      },
    ],
  },
  {
    category: "Cultural Adaptation",
    features: [
      {
        name: "Multi-language Support",
        description: "11 languages with cultural context adaptation",
        status: "active",
        capacity: "11 languages",
        icon: Globe,
      },
      {
        name: "Regional Customization",
        description: "Localized content and regulatory compliance",
        status: "active",
        capacity: "6 regions",
        icon: Settings,
      },
      {
        name: "Cultural AI Training",
        description: "AI models trained on cultural health practices",
        status: "active",
        capacity: "Multi-cultural",
        icon: Users,
      },
    ],
  },
  {
    category: "Performance Optimization",
    features: [
      {
        name: "Edge Computing",
        description: "Processing at edge locations for low latency",
        status: "active",
        capacity: "180+ locations",
        icon: Cloud,
      },
      {
        name: "Caching Strategy",
        description: "Multi-layer caching for optimal performance",
        status: "active",
        capacity: "99.9% hit rate",
        icon: Zap,
      },
      {
        name: "Resource Optimization",
        description: "Dynamic resource allocation and optimization",
        status: "active",
        capacity: "Real-time",
        icon: TrendingUp,
      },
    ],
  },
]

const regionalInfrastructure = [
  {
    region: "North America",
    datacenters: 12,
    users: "2.5M",
    latency: "< 50ms",
    availability: 99.99,
    languages: ["English", "Spanish", "French"],
    status: "active",
  },
  {
    region: "Europe",
    datacenters: 8,
    users: "1.8M",
    latency: "< 45ms",
    availability: 99.98,
    languages: ["English", "German", "French", "Italian", "Spanish"],
    status: "active",
  },
  {
    region: "Asia Pacific",
    datacenters: 15,
    users: "4.2M",
    latency: "< 60ms",
    availability: 99.97,
    languages: ["English", "Japanese", "Chinese", "Korean"],
    status: "active",
  },
  {
    region: "India",
    datacenters: 6,
    users: "3.1M",
    latency: "< 55ms",
    availability: 99.96,
    languages: ["English", "Hindi"],
    status: "expanding",
  },
  {
    region: "South America",
    datacenters: 4,
    users: "800K",
    latency: "< 70ms",
    availability: 99.95,
    languages: ["Spanish", "Portuguese"],
    status: "planned",
  },
  {
    region: "Africa",
    datacenters: 2,
    users: "200K",
    latency: "< 80ms",
    availability: 99.90,
    languages: ["English", "French"],
    status: "planned",
  },
]

const performanceMetrics = [
  { metric: "Concurrent Users", current: 125000, capacity: 10000000, unit: "" },
  { metric: "API Requests/sec", current: 45000, capacity: 1000000, unit: "/sec" },
  { metric: "Database Queries/sec", current: 180000, capacity: 5000000, unit: "/sec" },
  { metric: "Storage Capacity", current: 2.5, capacity: 1000, unit: "TB" },
]

export function ScalabilityInfrastructure() {
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Scalability Infrastructure</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Global infrastructure designed to scale to 10M+ users with cultural adaptation and optimal performance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {infrastructureMetrics.map((metric, index) => {
            const MetricIcon = metric.icon
            return (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <MetricIcon className="h-8 w-8 text-teal-400" />
                    <Badge 
                      className={
                        metric.status === 'optimal' 
                          ? "bg-green-600/20 text-green-300" 
                          : "bg-blue-600/20 text-blue-300"
                      }
                    >
                      {metric.status}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
                  <div className="text-sm text-gray-400 mb-2">{metric.metric}</div>
                  <div className="text-xs text-gray-500">{metric.description}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Scalability Features</h2>
          <div className="space-y-8">
            {scalabilityFeatures.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h3 className="text-xl font-semibold text-white mb-4">{category.category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.features.map((feature, featureIndex) => {
                    const FeatureIcon = feature.icon
                    return (
                      <Card key={featureIndex} className="bg-gray-800 border-gray-700">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-full bg-teal-600/20">
                              <FeatureIcon className="h-5 w-5 text-teal-400" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold">{feature.name}</h4>
                              <Badge className="bg-green-600/20 text-green-300 text-xs">
                                {feature.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-gray-400 text-sm mb-3">{feature.description}</p>
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Capacity:</span>
                            <span className="text-white font-medium">{feature.capacity}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Global Infrastructure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {regionalInfrastructure.map((region, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{region.region}</CardTitle>
                    <Badge 
                      className={
                        region.status === 'active' 
                          ? "bg-green-600/20 text-green-300" 
                          : region.status === 'expanding'
                          ? "bg-blue-600/20 text-blue-300"
                          : "bg-yellow-600/20 text-yellow-300"
                      }
                    >
                      {region.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Data Centers</div>
                      <div className="text-lg font-semibold text-white">{region.datacenters}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Users</div>
                      <div className="text-lg font-semibold text-white">{region.users}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Latency</div>
                      <div className="text-lg font-semibold text-white">{region.latency}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Availability</div>
                      <div className="text-lg font-semibold text-white">{region.availability}%</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">Supported Languages</div>
                    <div className="flex flex-wrap gap-1">
                      {region.languages.map((lang, idx) => (
                        <Badge key={idx} className="bg-blue-600/20 text-blue-300 text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-400">Availability</span>
                      <span className="text-white font-semibold">{region.availability}%</span>
                    </div>
                    <Progress value={region.availability} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Current Performance vs Capacity</h2>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8">
              <div className="space-y-6">
                {performanceMetrics.map((metric, index) => {
                  const utilizationPercent = (metric.current / metric.capacity) * 100
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-white">{metric.metric}</h3>
                        <div className="text-right">
                          <div className="text-white font-medium">
                            {metric.current.toLocaleString()}{metric.unit} / {metric.capacity.toLocaleString()}{metric.unit}
                          </div>
                          <div className="text-sm text-gray-400">
                            {utilizationPercent.toFixed(1)}% utilized
                          </div>
                        </div>
                      </div>
                      <Progress value={utilizationPercent} className="h-3" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 border-teal-500/20">
            <CardContent className="p-8">
              <Server className="h-12 w-12 text-teal-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Ready for Global Scale</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Infrastructure designed to seamlessly scale from thousands to millions of users with cultural adaptation and optimal performance worldwide
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  View Infrastructure Details
                </Button>
                <Button variant="outline" className="border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white">
                  Performance Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

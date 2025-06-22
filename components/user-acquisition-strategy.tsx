"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Target,
  TrendingUp,
  Globe,
  Stethoscope,
  BookOpen,
  Share2,
  Award,
  Calendar,
  DollarSign,
  UserPlus,
  BarChart3,
} from "lucide-react"

const acquisitionChannels = [
  {
    channel: "Healthcare Partnerships",
    description: "Partner with longevity clinics and practitioners",
    target: "10,000 users",
    cost: "$50 CAC",
    timeline: "Q1-Q2 2025",
    status: "active",
    roi: "300%",
    icon: Stethoscope,
    strategies: [
      "White-label solutions for clinics",
      "Practitioner referral program",
      "Medical conference presence",
      "Clinical case studies",
    ],
  },
  {
    channel: "Content Marketing",
    description: "Educational content and thought leadership",
    target: "25,000 users",
    cost: "$25 CAC",
    timeline: "Ongoing",
    status: "active",
    roi: "450%",
    icon: BookOpen,
    strategies: [
      "Longevity research blog",
      "YouTube educational series",
      "Podcast sponsorships",
      "Scientific paper summaries",
    ],
  },
  {
    channel: "Social Media",
    description: "Targeted campaigns on health-focused platforms",
    target: "15,000 users",
    cost: "$35 CAC",
    timeline: "Q1 2025",
    status: "planned",
    roi: "280%",
    icon: Share2,
    strategies: [
      "Instagram health influencers",
      "LinkedIn B2B targeting",
      "Reddit longevity communities",
      "Twitter thought leadership",
    ],
  },
  {
    channel: "Global Expansion",
    description: "International markets with localized approach",
    target: "50,000 users",
    cost: "$40 CAC",
    timeline: "Q2-Q4 2025",
    status: "planned",
    roi: "350%",
    icon: Globe,
    strategies: [
      "India market entry (Hindi support)",
      "European GDPR compliance",
      "Cultural adaptation programs",
      "Local partnership networks",
    ],
  },
]

const conversionFunnel = [
  { stage: "Awareness", users: 100000, conversion: 100, color: "blue" },
  { stage: "Interest", users: 25000, conversion: 25, color: "green" },
  { stage: "Consideration", users: 10000, conversion: 10, color: "yellow" },
  { stage: "Trial", users: 5000, conversion: 5, color: "orange" },
  { stage: "Paid", users: 2500, conversion: 2.5, color: "red" },
]

const marketingMetrics = [
  { metric: "Total Addressable Market", value: "$13.2B", growth: "+15% YoY", icon: Target },
  { metric: "Customer Acquisition Cost", value: "$38", trend: "-12%", icon: DollarSign },
  { metric: "Customer Lifetime Value", value: "$1,247", trend: "+23%", icon: TrendingUp },
  { metric: "Monthly Active Users", value: "12,450", trend: "+45%", icon: Users },
]

export function UserAcquisitionStrategy() {
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">User Acquisition Strategy</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comprehensive plan to acquire 100,000+ users across multiple channels with focus on healthcare partnerships and global expansion
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {marketingMetrics.map((metric, index) => {
            const MetricIcon = metric.icon
            return (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <MetricIcon className="h-8 w-8 text-teal-400" />
                    <Badge className="bg-green-600/20 text-green-300">
                      {metric.trend || metric.growth}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
                  <div className="text-sm text-gray-400">{metric.metric}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Acquisition Channels */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Acquisition Channels</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {acquisitionChannels.map((channel, index) => {
              const ChannelIcon = channel.icon
              return (
                <Card key={index} className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-teal-600/20">
                          <ChannelIcon className="h-6 w-6 text-teal-400" />
                        </div>
                        <div>
                          <CardTitle className="text-white">{channel.channel}</CardTitle>
                          <CardDescription>{channel.description}</CardDescription>
                        </div>
                      </div>
                      <Badge 
                        className={
                          channel.status === 'active' 
                            ? "bg-green-600/20 text-green-300" 
                            : "bg-yellow-600/20 text-yellow-300"
                        }
                      >
                        {channel.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-gray-400">Target Users</div>
                        <div className="text-lg font-semibold text-white">{channel.target}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">CAC</div>
                        <div className="text-lg font-semibold text-white">{channel.cost}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Timeline</div>
                        <div className="text-lg font-semibold text-white">{channel.timeline}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">ROI</div>
                        <div className="text-lg font-semibold text-green-400">{channel.roi}</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-white font-medium mb-2">Key Strategies:</h4>
                      <div className="space-y-2">
                        {channel.strategies.map((strategy, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                            <div className="w-1.5 h-1.5 bg-teal-400 rounded-full"></div>
                            {strategy}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button className="w-full bg-teal-600 hover:bg-teal-700">
                      View Detailed Plan
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Conversion Funnel Analysis</h2>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8">
              <div className="space-y-6">
                {conversionFunnel.map((stage, index) => (
                  <div key={index} className="flex items-center gap-6">
                    <div className="w-32 text-right">
                      <div className="text-white font-semibold">{stage.stage}</div>
                      <div className="text-sm text-gray-400">{stage.conversion}%</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{stage.users.toLocaleString()} users</span>
                        <span className="text-sm text-gray-400">{stage.conversion}% conversion</span>
                      </div>
                      <Progress 
                        value={stage.conversion} 
                        className="h-3"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Implementation Timeline */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Implementation Timeline</h2>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q1 2025</h3>
                    <p className="text-sm text-gray-400">Healthcare partnerships launch</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Share2 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q2 2025</h3>
                    <p className="text-sm text-gray-400">Social media campaigns</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Globe className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q3 2025</h3>
                    <p className="text-sm text-gray-400">Global expansion</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q4 2025</h3>
                    <p className="text-sm text-gray-400">100K users milestone</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 border-teal-500/20">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to Execute Strategy</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Comprehensive user acquisition plan targeting 100,000+ users with $38 average CAC and 350% ROI across multiple channels
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  Launch Campaign
                </Button>
                <Button variant="outline" className="border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white">
                  Download Strategy
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

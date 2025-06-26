"use client"

import {
  Activity,
  TrendingUp,
  Zap,
  Shield,
  Target,
  Award,
  BookOpen,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Flame,
} from "lucide-react"
import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts"

import { HealthScoreAnalytics } from "@/components/health-score-analytics"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock user data
const userData = {
  name: "Alex Johnson",
  age: 35,
  joinDate: "2024-01-15",
  membershipLevel: "Premium",
  totalMixtures: 23,
  researchPapers: 156,
  communityPosts: 12,
  streakDays: 45,
}

// Mock biomarker data
const biomarkerData = [
  { name: "NAD+", current: 85, target: 90, unit: "μM", trend: "up", change: "+12%" },
  { name: "Telomere Length", current: 7.2, target: 8.0, unit: "kb", trend: "up", change: "+5%" },
  { name: "Inflammation (CRP)", current: 1.2, target: 1.0, unit: "mg/L", trend: "down", change: "-15%" },
  { name: "HbA1c", current: 5.1, target: 5.0, unit: "%", trend: "stable", change: "0%" },
  { name: "Vitamin D", current: 45, target: 50, unit: "ng/mL", trend: "up", change: "+8%" },
  { name: "Omega-3 Index", current: 6.8, target: 8.0, unit: "%", trend: "up", change: "+18%" },
]

// Mock progress data
const progressData = [
  { month: "Jan", energy: 65, sleep: 70, mood: 68, focus: 72 },
  { month: "Feb", energy: 70, sleep: 75, mood: 72, focus: 75 },
  { month: "Mar", energy: 75, sleep: 78, mood: 76, focus: 78 },
  { month: "Apr", energy: 78, sleep: 80, mood: 79, focus: 80 },
  { month: "May", energy: 82, sleep: 82, mood: 81, focus: 83 },
  { month: "Jun", energy: 85, sleep: 85, mood: 84, focus: 85 },
]

// Mock compound usage data
const compoundData = [
  { name: "NMN", usage: 30, color: "#0ea5e9" },
  { name: "Resveratrol", usage: 25, color: "#8b5cf6" },
  { name: "Quercetin", usage: 20, color: "#10b981" },
  { name: "Curcumin", usage: 15, color: "#f59e0b" },
  { name: "Others", usage: 10, color: "#6b7280" },
]

// Mock achievements
const achievements = [
  { id: 1, title: "Research Explorer", description: "Read 100+ research papers", icon: BookOpen, earned: true },
  { id: 2, title: "Consistency Champion", description: "45-day tracking streak", icon: Flame, earned: true },
  { id: 3, title: "Community Helper", description: "Helped 10+ community members", icon: Users, earned: true },
  { id: 4, title: "Safety First", description: "Completed all safety modules", icon: Shield, earned: true },
  { id: 5, title: "Biomarker Master", description: "Improved 5+ biomarkers", icon: TrendingUp, earned: false },
  { id: 6, title: "Longevity Scholar", description: "Complete advanced course", icon: Award, earned: false },
]

// Mock recent activities
const recentActivities = [
  { id: 1, type: "mixture", description: "Created new NMN + Resveratrol mixture", time: "2 hours ago", icon: Zap },
  { id: 2, type: "research", description: "Saved paper on senolytic compounds", time: "5 hours ago", icon: BookOpen },
  { id: 3, type: "biomarker", description: "Updated NAD+ levels", time: "1 day ago", icon: Activity },
  { id: 4, type: "community", description: "Posted in Beginner's Forum", time: "2 days ago", icon: Users },
  { id: 5, type: "goal", description: "Completed weekly wellness check", time: "3 days ago", icon: Target },
]

export function UserDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("6months")
  const [wearableConnected, setWearableConnected] = useState(false)

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-400" />
      case "down":
        return <TrendingUp className="h-4 w-4 text-red-400 rotate-180" />
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up":
        return "text-green-400"
      case "down":
        return "text-red-400"
      default:
        return "text-gray-400"
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Welcome back, {userData.name}!</h1>
            <p className="text-gray-400">Track your longevity journey and optimize your health</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">{userData.membershipLevel}</Badge>
            <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">
              <Flame className="h-3 w-3 mr-1" />
              {userData.streakDays} day streak
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 rounded-full p-2">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{userData.totalMixtures}</p>
                  <p className="text-gray-400 text-sm">Mixtures Created</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 rounded-full p-2">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{userData.researchPapers}</p>
                  <p className="text-gray-400 text-sm">Papers Read</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 rounded-full p-2">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{userData.communityPosts}</p>
                  <p className="text-gray-400 text-sm">Community Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 rounded-full p-2">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">8.2</p>
                  <p className="text-gray-400 text-sm">Health Score</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-xs text-green-400">+0.3 this week</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Biomarkers */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Biomarker Tracking
              </CardTitle>
              <CardDescription>Monitor key longevity biomarkers and track your progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {biomarkerData.map((biomarker, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-white font-medium">{biomarker.name}</h4>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(biomarker.trend)}
                        <span className={`text-sm font-medium ${getTrendColor(biomarker.trend)}`}>
                          {biomarker.change}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>
                        Current: {biomarker.current} {biomarker.unit}
                      </span>
                      <span>
                        Target: {biomarker.target} {biomarker.unit}
                      </span>
                    </div>

                    <Progress value={(biomarker.current / biomarker.target) * 100} className="w-full" />
                  </div>
                ))}
              </div>

              {!wearableConnected && (
                <Alert className="mt-4 border-blue-500/20 bg-blue-500/10">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-200 text-sm">
                    Connect your wearable device for automatic biomarker tracking and more accurate insights.
                    <Button size="sm" className="ml-2 bg-blue-600 hover:bg-blue-700">
                      Connect Device
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Progress Charts */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress Overview
              </CardTitle>
              <CardDescription>Your wellness metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="wellness" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-gray-600">
                  <TabsTrigger value="wellness">Wellness</TabsTrigger>
                  <TabsTrigger value="compounds">Compounds</TabsTrigger>
                  <TabsTrigger value="biomarkers">Biomarkers</TabsTrigger>
                </TabsList>

                <TabsContent value="wellness" className="mt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="energy"
                        stackId="1"
                        stroke="#0ea5e9"
                        fill="#0ea5e9"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="sleep"
                        stackId="1"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="mood"
                        stackId="1"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="focus"
                        stackId="1"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="compounds" className="mt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={compoundData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="usage"
                        label={({ name, usage }) => `${name}: ${usage}%`}
                      >
                        {compoundData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="biomarkers" className="mt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={biomarkerData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="current" fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Achievements */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievements
              </CardTitle>
              <CardDescription>Your longevity journey milestones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      achievement.earned ? "bg-teal-900/20 border border-teal-500/20" : "bg-gray-700"
                    }`}
                  >
                    <div className={`p-2 rounded-full ${achievement.earned ? "bg-teal-600" : "bg-gray-600"}`}>
                      <achievement.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${achievement.earned ? "text-teal-300" : "text-gray-300"}`}>
                        {achievement.title}
                      </p>
                      <p className="text-gray-400 text-xs">{achievement.description}</p>
                    </div>
                    {achievement.earned && <CheckCircle className="h-5 w-5 text-teal-400" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="bg-gray-700 p-2 rounded-full">
                      <activity.icon className="h-4 w-4 text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-300 text-sm">{activity.description}</p>
                      <p className="text-gray-500 text-xs">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Health Score Breakdown */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5" />
                Health Score Breakdown
              </CardTitle>
              <CardDescription>Your comprehensive longevity metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Longevity Score</span>
                  <div className="flex items-center gap-2">
                    <Progress value={85} className="w-16" />
                    <span className="text-white font-medium">8.5</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Optimization Score</span>
                  <div className="flex items-center gap-2">
                    <Progress value={78} className="w-16" />
                    <span className="text-white font-medium">7.8</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Consistency Score</span>
                  <div className="flex items-center gap-2">
                    <Progress value={82} className="w-16" />
                    <span className="text-white font-medium">8.2</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="text-teal-300 font-medium">Overall Health Score</span>
                    <span className="text-2xl font-bold text-teal-300">8.2</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Level 8 - Advanced Optimizer</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button className="w-full bg-teal-600 hover:bg-teal-700 justify-start">
                  <Zap className="h-4 w-4 mr-2" />
                  Create New Mixture
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 justify-start"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Browse Research
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 justify-start"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Update Biomarkers
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 justify-start"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Visit Community
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Health Score Analytics */}
          <div className="md:col-span-2">
            <HealthScoreAnalytics />
          </div>
        </div>
      </div>
    </div>
  )
}

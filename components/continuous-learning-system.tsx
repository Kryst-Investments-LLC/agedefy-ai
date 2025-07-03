"use client"

import { Brain, BookOpen, TrendingUp, Target, CheckCircle, Clock, Award } from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
export function ContinuousLearningSystem() {
  const [selectedCourse, setSelectedCourse] = useState("longevity-fundamentals")

  const learningPaths = [
    {
      id: "longevity-fundamentals",
      title: "Longevity Fundamentals",
      description: "Master the basics of aging science and intervention strategies",
      progress: 78,
      modules: 12,
      completed: 9,
      duration: "6 weeks",
      difficulty: "Beginner",
      topics: ["Cellular aging", "Biomarkers", "Nutrition", "Exercise", "Sleep optimization"]
    },
    {
      id: "advanced-biohacking",
      title: "Advanced Biohacking",
      description: "Deep dive into cutting-edge longevity interventions",
      progress: 45,
      modules: 16,
      completed: 7,
      duration: "10 weeks",
      difficulty: "Advanced",
      topics: ["Peptides", "NAD+ optimization", "Hormetic stress", "Cold therapy", "Photobiomodulation"]
    },
    {
      id: "personalized-medicine",
      title: "Personalized Medicine",
      description: "Learn to interpret your biomarkers and genetic data",
      progress: 23,
      modules: 8,
      completed: 2,
      duration: "4 weeks",
      difficulty: "Intermediate",
      topics: ["Genetic analysis", "Biomarker interpretation", "Protocol design", "Risk assessment"]
    }
  ]

  const recentLessons = [
    {
      title: "Understanding Telomere Biology",
      course: "Longevity Fundamentals",
      duration: "15 min",
      completed: true,
      score: 92
    },
    {
      title: "NAD+ Precursors Comparison",
      course: "Advanced Biohacking",
      duration: "22 min",
      completed: true,
      score: 88
    },
    {
      title: "Interpreting Lipid Panels",
      course: "Personalized Medicine",
      duration: "18 min",
      completed: false,
      score: null
    }
  ]

  const achievements = [
    { name: "First Course Completed", icon: Award, earned: true, date: "2024-11-15" },
    { name: "Perfect Score Streak", icon: Target, earned: true, date: "2024-12-01" },
    { name: "Knowledge Master", icon: Brain, earned: false, date: null },
    { name: "Community Contributor", icon: CheckCircle, earned: true, date: "2024-12-10" }
  ]

  const aiRecommendations = [
    {
      type: "course",
      title: "Mitochondrial Optimization",
      reason: "Based on your biomarker data showing suboptimal cellular energy",
      priority: "high"
    },
    {
      type: "topic",
      title: "Sleep Architecture Deep Dive",
      reason: "Your sleep quality scores suggest room for improvement",
      priority: "medium"
    },
    {
      type: "skill",
      title: "Data Interpretation Skills",
      reason: "To better understand your lab results and trends",
      priority: "low"
    }
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Intermediate": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "Advanced": return "bg-red-600/20 text-red-300 border-red-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Continuous Learning System</h2>
        <p className="text-gray-400">AI-powered personalized education for longevity optimization</p>
      </div>

      <Tabs defaultValue="learning-paths" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="learning-paths" className="text-gray-300">Learning Paths</TabsTrigger>
          <TabsTrigger value="recent-activity" className="text-gray-300">Recent Activity</TabsTrigger>
          <TabsTrigger value="achievements" className="text-gray-300">Achievements</TabsTrigger>
          <TabsTrigger value="ai-recommendations" className="text-gray-300">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="learning-paths" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {learningPaths.map((path) => (
              <Card 
                key={path.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedCourse === path.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedCourse(path.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">{path.title}</CardTitle>
                    <Badge className={getDifficultyColor(path.difficulty)}>
                      {path.difficulty}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {path.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">{path.progress}%</span>
                    </div>
                    <Progress value={path.progress} className="h-2" />
                    
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{path.completed}/{path.modules} modules</span>
                      <span>{path.duration}</span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-gray-300">Topics covered:</h4>
                      <div className="flex flex-wrap gap-1">
                        {path.topics.slice(0, 3).map((topic, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                        {path.topics.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{path.topics.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedCourse && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Course Details</CardTitle>
                <CardDescription className="text-gray-400">
                  {learningPaths.find(p => p.id === selectedCourse)?.title}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-medium mb-3">All Topics</h4>
                    <div className="space-y-2">
                      {learningPaths.find(p => p.id === selectedCourse)?.topics.map((topic, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-gray-300">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-3">Course Stats</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completion Rate</span>
                        <span className="text-white">{learningPaths.find(p => p.id === selectedCourse)?.progress}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration</span>
                        <span className="text-white">{learningPaths.find(p => p.id === selectedCourse)?.duration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Modules</span>
                        <span className="text-white">{learningPaths.find(p => p.id === selectedCourse)?.modules}</span>
                      </div>
                    </div>
                    <Button className="w-full mt-4 bg-teal-600 hover:bg-teal-700">
                      Continue Learning
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recent-activity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentLessons.map((lesson, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    {lesson.title}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    {lesson.course}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Duration</span>
                      <span className="text-white text-sm">{lesson.duration}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Status</span>
                      <Badge variant={lesson.completed ? "default" : "secondary"}>
                        {lesson.completed ? "Completed" : "In Progress"}
                      </Badge>
                    </div>

                    {lesson.score && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Score</span>
                        <span className="text-white text-sm font-bold">{lesson.score}%</span>
                      </div>
                    )}

                    <Button 
                      variant={lesson.completed ? "outline" : "default"} 
                      className="w-full"
                    >
                      {lesson.completed ? "Review" : "Continue"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement, index) => (
              <Card key={index} className={`bg-gray-800/50 border-gray-700 ${achievement.earned ? 'ring-1 ring-yellow-500/50' : ''}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <achievement.icon className={`h-5 w-5 ${achievement.earned ? 'text-yellow-400' : 'text-gray-500'}`} />
                    {achievement.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Badge variant={achievement.earned ? "default" : "secondary"}>
                      {achievement.earned ? "Earned" : "Locked"}
                    </Badge>
                    {achievement.date && (
                      <span className="text-gray-400 text-sm">{achievement.date}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ai-recommendations" className="space-y-4">
          <div className="space-y-4">
            {aiRecommendations.map((rec, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      {rec.title}
                    </CardTitle>
                    <Badge 
                      className={
                        rec.priority === "high" ? "bg-red-600/20 text-red-300 border-red-500/20" :
                        rec.priority === "medium" ? "bg-yellow-600/20 text-yellow-300 border-yellow-500/20" :
                        "bg-green-600/20 text-green-300 border-green-500/20"
                      }
                    >
                      {rec.priority} priority
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">{rec.reason}</p>
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    Start Learning
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

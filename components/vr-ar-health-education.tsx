"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Brain, Heart, Microscope, Play, Headphones, Monitor, Smartphone } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function VRARHealthEducation() {
  const { t } = useTranslation()
  const [selectedExperience, setSelectedExperience] = useState("cellular-aging")

  const vrExperiences = [
    {
      id: "cellular-aging",
      title: "Journey Through Cellular Aging",
      description: "Explore how cells age at the molecular level",
      duration: "15 min",
      difficulty: "Beginner",
      type: "VR",
      completed: true,
      rating: 4.8,
      topics: ["Mitochondria", "DNA damage", "Protein aggregation", "Senescence"]
    },
    {
      id: "cardiovascular-system",
      title: "Heart Health Visualization",
      description: "Interactive exploration of cardiovascular aging",
      duration: "20 min",
      difficulty: "Intermediate",
      type: "VR",
      completed: false,
      rating: 4.9,
      topics: ["Arterial stiffening", "Plaque formation", "Blood flow", "Heart muscle"]
    },
    {
      id: "brain-optimization",
      title: "Neuroplasticity & Brain Health",
      description: "Discover how the brain adapts and ages",
      duration: "25 min",
      difficulty: "Advanced",
      type: "VR",
      completed: false,
      rating: 4.7,
      topics: ["Synaptic plasticity", "Neurogenesis", "Cognitive reserve", "Memory formation"]
    }
  ]

  const arExperiences = [
    {
      id: "supplement-interaction",
      title: "Supplement Interaction Visualizer",
      description: "See how supplements interact in your body",
      duration: "10 min",
      difficulty: "Beginner",
      type: "AR",
      completed: true,
      rating: 4.6,
      topics: ["Absorption", "Metabolism", "Interactions", "Bioavailability"]
    },
    {
      id: "exercise-physiology",
      title: "Exercise Physiology AR",
      description: "Visualize muscle activation and energy systems",
      duration: "18 min",
      difficulty: "Intermediate",
      type: "AR",
      completed: false,
      rating: 4.8,
      topics: ["Muscle fibers", "Energy systems", "Recovery", "Adaptation"]
    },
    {
      id: "biomarker-tracking",
      title: "Biomarker Data Overlay",
      description: "AR visualization of your health metrics",
      duration: "12 min",
      difficulty: "Beginner",
      type: "AR",
      completed: true,
      rating: 4.5,
      topics: ["Blood markers", "Trends", "Correlations", "Predictions"]
    }
  ]

  const deviceCompatibility = [
    { name: "Meta Quest 3", type: "VR", compatible: true, features: ["Hand tracking", "Mixed reality"] },
    { name: "Apple Vision Pro", type: "VR/AR", compatible: true, features: ["Eye tracking", "Spatial computing"] },
    { name: "HoloLens 2", type: "AR", compatible: true, features: ["Gesture control", "Spatial mapping"] },
    { name: "iPhone/iPad", type: "AR", compatible: true, features: ["ARKit", "LiDAR scanning"] },
    { name: "Android Devices", type: "AR", compatible: true, features: ["ARCore", "Motion tracking"] }
  ]

  const learningProgress = [
    { category: "Cellular Biology", progress: 85, experiences: 4 },
    { category: "Cardiovascular Health", progress: 60, experiences: 3 },
    { category: "Neurological Function", progress: 40, experiences: 2 },
    { category: "Exercise Physiology", progress: 75, experiences: 3 },
    { category: "Nutrition Science", progress: 30, experiences: 1 }
  ]

  const allExperiences = [...vrExperiences, ...arExperiences]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Intermediate": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "Advanced": return "bg-red-600/20 text-red-300 border-red-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getTypeIcon = (type: string) => {
    return type === "VR" ? <Headphones className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">VR/AR Health Education</h2>
        <p className="text-gray-400">Immersive learning experiences for longevity science</p>
      </div>

      <Tabs defaultValue="experiences" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="experiences" className="text-gray-300">Experiences</TabsTrigger>
          <TabsTrigger value="progress" className="text-gray-300">Learning Progress</TabsTrigger>
          <TabsTrigger value="devices" className="text-gray-300">Device Support</TabsTrigger>
          <TabsTrigger value="library" className="text-gray-300">Content Library</TabsTrigger>
        </TabsList>

        <TabsContent value="experiences" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allExperiences.map((experience) => (
              <Card 
                key={experience.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedExperience === experience.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedExperience(experience.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      {getTypeIcon(experience.type)}
                      {experience.title}
                    </CardTitle>
                    <Badge className={experience.type === "VR" ? "bg-purple-600/20 text-purple-300 border-purple-500/20" : "bg-blue-600/20 text-blue-300 border-blue-500/20"}>
                      {experience.type}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {experience.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Badge className={getDifficultyColor(experience.difficulty)}>
                        {experience.difficulty}
                      </Badge>
                      <span className="text-gray-400 text-sm">{experience.duration}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Rating</span>
                      <span className="text-yellow-400 text-sm">★ {experience.rating}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Status</span>
                      <Badge variant={experience.completed ? "default" : "secondary"}>
                        {experience.completed ? "Completed" : "Available"}
                      </Badge>
                    </div>

                    <Button 
                      className={`w-full ${experience.completed ? 'bg-gray-600 hover:bg-gray-700' : 'bg-teal-600 hover:bg-teal-700'}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {experience.completed ? "Replay" : "Start Experience"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learningProgress.map((category, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">{category.progress}%</span>
                    </div>
                    <Progress value={category.progress} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Experiences</span>
                      <span className="text-white">{category.experiences} completed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceCompatibility.map((device, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    {device.type.includes("VR") ? <Headphones className="h-5 w-5 text-purple-400" /> : <Monitor className="h-5 w-5 text-blue-400" />}
                    {device.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Type</span>
                      <Badge variant="secondary">{device.type}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Status</span>
                      <Badge variant={device.compatible ? "default" : "secondary"}>
                        {device.compatible ? "Supported" : "Coming Soon"}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="text-gray-300 text-sm font-medium mb-2">Features</h4>
                      <div className="space-y-1">
                        {device.features.map((feature, idx) => (
                          <div key={idx} className="text-xs text-gray-400">• {feature}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-purple-400" />
                  VR Experiences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vrExperiences.map((exp, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div>
                        <h4 className="text-white text-sm font-medium">{exp.title}</h4>
                        <p className="text-gray-400 text-xs">{exp.duration}</p>
                      </div>
                      <Badge variant={exp.completed ? "default" : "secondary"}>
                        {exp.completed ? "Completed" : "Available"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                  AR Experiences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {arExperiences.map((exp, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div>
                        <h4 className="text-white text-sm font-medium">{exp.title}</h4>
                        <p className="text-gray-400 text-xs">{exp.duration}</p>
                      </div>
                      <Badge variant={exp.completed ? "default" : "secondary"}>
                        {exp.completed ? "Completed" : "Available"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

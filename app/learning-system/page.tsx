import React from "react"
import { ContinuousLearningSystem } from "@/components/continuous-learning-system"
import { Navigation } from "@/components/navigation"

export default function LearningSystemPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <ContinuousLearningSystem />
      </div>
    </div>
  )
}

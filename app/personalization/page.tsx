import React from "react"
import { EnhancedAIPersonalization } from "@/components/enhanced-ai-personalization"
import { Navigation } from "@/components/navigation"

export default function PersonalizationPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <EnhancedAIPersonalization />
    </div>
  )
}

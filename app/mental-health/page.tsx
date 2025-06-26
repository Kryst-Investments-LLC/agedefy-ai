import React from "react"

import { MentalHealthOptimization } from "@/components/mental-health-optimization"
import { Navigation } from "@/components/navigation"

export default function MentalHealthPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <MentalHealthOptimization />
      </div>
    </div>
  )
}

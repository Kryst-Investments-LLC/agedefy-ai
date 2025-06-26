import React from "react"

import { AdvancedDataVisualization } from "@/components/advanced-data-visualization"
import { Navigation } from "@/components/navigation"

export default function DataVisualizationPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <AdvancedDataVisualization />
      </div>
    </div>
  )
}

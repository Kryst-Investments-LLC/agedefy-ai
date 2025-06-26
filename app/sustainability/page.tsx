import React from "react"

import { Navigation } from "@/components/navigation"
import { SustainabilityInsights } from "@/components/sustainability-insights"

export default function SustainabilityPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <SustainabilityInsights />
      </div>
    </div>
  )
}

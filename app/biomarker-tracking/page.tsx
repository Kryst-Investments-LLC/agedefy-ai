import React from "react"
import { AdvancedBiomarkerTracking } from "@/components/advanced-biomarker-tracking"
import { Navigation } from "@/components/navigation"

export default function BiomarkerTrackingPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <AdvancedBiomarkerTracking />
      </div>
    </div>
  )
}

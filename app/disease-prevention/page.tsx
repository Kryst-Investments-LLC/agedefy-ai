import React from "react"

import { AIDrivenDiseasePrevention } from "@/components/ai-driven-disease-prevention"
import { Navigation } from "@/components/navigation"

export default function DiseasePreventionPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <AIDrivenDiseasePrevention />
      </div>
    </div>
  )
}

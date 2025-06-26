import React from "react"

import { Navigation } from "@/components/navigation"
import { VRARHealthEducation } from "@/components/vr-ar-health-education"

export default function VRAREducationPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <VRARHealthEducation />
      </div>
    </div>
  )
}

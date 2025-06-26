import React from "react"

import { HealthRecordIntegration } from "@/components/health-record-integration"
import { Navigation } from "@/components/navigation"

export default function HealthRecordsPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <HealthRecordIntegration />
      </div>
    </div>
  )
}
